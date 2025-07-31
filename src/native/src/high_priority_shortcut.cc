#include <napi.h>
#include <windows.h>
#include <thread>
#include <map>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include <sstream>

// Global state variables
std::thread hotkeyThread;
std::thread mouseHookThread;
DWORD hotkeyThreadId = 0;
bool isRunning = false;
bool mouseHookRunning = false;
Napi::ThreadSafeFunction tsfn;
std::map<int, std::string> idToActionMap;
std::map<std::pair<UINT, UINT>, std::string> mouseKeyMap; // (modifiers, mouseButton) -> action
HHOOK mouseHook = NULL;

// Mouse hook procedure
LRESULT CALLBACK MouseHookProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0 && mouseHookRunning) {
        UINT mouseButton = 0;
        if (wParam == WM_XBUTTONDOWN) {
            MSLLHOOKSTRUCT* pMouseStruct = (MSLLHOOKSTRUCT*)lParam;
            WORD xButton = HIWORD(pMouseStruct->mouseData);
            if (xButton == XBUTTON1) mouseButton = 1; // Mouse side button 1
            else if (xButton == XBUTTON2) mouseButton = 2; // Mouse side button 2
            
            // Get current modifier key states
            UINT modifiers = 0;
            if (GetAsyncKeyState(VK_CONTROL) & 0x8000) modifiers |= MOD_CONTROL;
            if (GetAsyncKeyState(VK_SHIFT) & 0x8000) modifiers |= MOD_SHIFT;
            if (GetAsyncKeyState(VK_MENU) & 0x8000) modifiers |= MOD_ALT;
            if (GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000) modifiers |= MOD_WIN;
            
            auto key = std::make_pair(modifiers, mouseButton);
            auto it = mouseKeyMap.find(key);
            if (it != mouseKeyMap.end()) {
                std::string action = it->second;
                if (tsfn) {
                    tsfn.NonBlockingCall([action](Napi::Env env, Napi::Function jsCallback) {
                        jsCallback.Call({Napi::String::New(env, action)});
                    });
                }
                return 1; // Consume this event
            }
        }
    }
    return CallNextHookEx(mouseHook, nCode, wParam, lParam);
}

// Stop hotkey listener
void StopHotkeyListener() {
    // Stop mouse hook
    if (mouseHook) {
        UnhookWindowsHookEx(mouseHook);
        mouseHook = NULL;
        mouseHookRunning = false;
    }
    
    // Stop hotkey listening
    if (isRunning && hotkeyThreadId != 0) {
        PostThreadMessage(hotkeyThreadId, WM_QUIT, 0, 0);
        if (hotkeyThread.joinable()) {
            hotkeyThread.join();
        }
        hotkeyThreadId = 0;
        isRunning = false;
    }
    
    // Clean up resources
    if (tsfn) {
        tsfn.Release();
        tsfn = nullptr;
    }
    
    mouseKeyMap.clear();
}

// Enhanced function to convert string to virtual key code and modifiers
bool StringToVk(const std::string& keyString, UINT& vkCode, UINT& modifiers, UINT& mouseButton) {
    vkCode = 0;
    modifiers = 0;
    mouseButton = 0;
    
    // Split key string
    std::vector<std::string> parts;
    std::stringstream ss(keyString);
    std::string part;
    while (std::getline(ss, part, '+')) {
        // Remove spaces
        part.erase(std::remove_if(part.begin(), part.end(), ::isspace), part.end());
        if (!part.empty()) {
            parts.push_back(part);
        }
    }
    
    if (parts.empty()) return false;

    // Process modifier keys
    for (size_t i = 0; i < parts.size() - 1; ++i) {
        std::string modifier = parts[i];
        std::transform(modifier.begin(), modifier.end(), modifier.begin(), ::toupper);
        
        if (modifier == "SHIFT") modifiers |= MOD_SHIFT;
        else if (modifier == "CONTROL" || modifier == "CTRL") modifiers |= MOD_CONTROL;
        else if (modifier == "ALT") modifiers |= MOD_ALT;
        else if (modifier == "WIN" || modifier == "WINDOWS" || modifier == "CMD") modifiers |= MOD_WIN;
    }

    // Process the main key
    std::string key = parts.back();
    std::transform(key.begin(), key.end(), key.begin(), ::toupper);

    // Check if it's a mouse side button
    if (key == "XBUTTON1" || key == "X1" || key == "MOUSESIDE1") {
        mouseButton = 1;
        return true;
    } else if (key == "XBUTTON2" || key == "X2" || key == "MOUSESIDE2") {
        mouseButton = 2;
        return true;
    }

    // Process single character keys
    if (key.length() == 1) {
        char c = key[0];
        if (c >= 'A' && c <= 'Z') vkCode = c;
        else if (c >= '0' && c <= '9') vkCode = c;
        else {
            // Special symbol keys
            switch (c) {
                case '`': case '~': vkCode = VK_OEM_3; break;  // `~
                case '-': case '_': vkCode = VK_OEM_MINUS; break; // -_
                case '=': case '+': vkCode = VK_OEM_PLUS; break;  // =+
                case '[': case '{': vkCode = VK_OEM_4; break;     // [{
                case ']': case '}': vkCode = VK_OEM_6; break;     // ]}
                case '\\': case '|': vkCode = VK_OEM_5; break;    // \|
                case ';': case ':': vkCode = VK_OEM_1; break;     // ;:
                case '\'': case '"': vkCode = VK_OEM_7; break;    // '"
                case ',': case '<': vkCode = VK_OEM_COMMA; break; // ,<
                case '.': case '>': vkCode = VK_OEM_PERIOD; break;// .>
                case '/': case '?': vkCode = VK_OEM_2; break;     // /?
            }
        }
    }
    // Function keys
    else if (key.rfind("F", 0) == 0 && key.length() > 1) {
        try {
            int fkey = std::stoi(key.substr(1));
            if (fkey >= 1 && fkey <= 24) {
                vkCode = VK_F1 + (fkey - 1);
            }
        } catch (...) {}
    }
    // Special keys
    else {
        if (key == "INSERT") vkCode = VK_INSERT;
        else if (key == "DELETE" || key == "DEL") vkCode = VK_DELETE;
        else if (key == "HOME") vkCode = VK_HOME;
        else if (key == "END") vkCode = VK_END;
        else if (key == "PAGEUP" || key == "PGUP") vkCode = VK_PRIOR;
        else if (key == "PAGEDOWN" || key == "PGDN") vkCode = VK_NEXT;
        else if (key == "UP" || key == "UPARROW") vkCode = VK_UP;
        else if (key == "DOWN" || key == "DOWNARROW") vkCode = VK_DOWN;
        else if (key == "LEFT" || key == "LEFTARROW") vkCode = VK_LEFT;
        else if (key == "RIGHT" || key == "RIGHTARROW") vkCode = VK_RIGHT;
        else if (key == "SPACE" || key == "SPACEBAR") vkCode = VK_SPACE;
        else if (key == "TAB") vkCode = VK_TAB;
        else if (key == "ENTER" || key == "RETURN") vkCode = VK_RETURN;
        else if (key == "ESCAPE" || key == "ESC") vkCode = VK_ESCAPE;
        else if (key == "BACKSPACE" || key == "BACK") vkCode = VK_BACK;
        else if (key == "CAPSLOCK" || key == "CAPS") vkCode = VK_CAPITAL;
        else if (key == "NUMLOCK") vkCode = VK_NUMLOCK;
        else if (key == "SCROLLLOCK") vkCode = VK_SCROLL;
        else if (key == "PRINTSCREEN" || key == "PRTSC") vkCode = VK_SNAPSHOT;
        else if (key == "PAUSE") vkCode = VK_PAUSE;
        else if (key == "APPS" || key == "MENU") vkCode = VK_APPS;
        // Numpad keys
        else if (key == "NUMPAD0") vkCode = VK_NUMPAD0;
        else if (key == "NUMPAD1") vkCode = VK_NUMPAD1;
        else if (key == "NUMPAD2") vkCode = VK_NUMPAD2;
        else if (key == "NUMPAD3") vkCode = VK_NUMPAD3;
        else if (key == "NUMPAD4") vkCode = VK_NUMPAD4;
        else if (key == "NUMPAD5") vkCode = VK_NUMPAD5;
        else if (key == "NUMPAD6") vkCode = VK_NUMPAD6;
        else if (key == "NUMPAD7") vkCode = VK_NUMPAD7;
        else if (key == "NUMPAD8") vkCode = VK_NUMPAD8;
        else if (key == "NUMPAD9") vkCode = VK_NUMPAD9;
        else if (key == "MULTIPLY" || key == "NUMPADMULTIPLY") vkCode = VK_MULTIPLY;
        else if (key == "ADD" || key == "NUMPADADD") vkCode = VK_ADD;
        else if (key == "SUBTRACT" || key == "NUMPADSUBTRACT") vkCode = VK_SUBTRACT;
        else if (key == "DECIMAL" || key == "NUMPADDECIMAL") vkCode = VK_DECIMAL;
        else if (key == "DIVIDE" || key == "NUMPADDIVIDE") vkCode = VK_DIVIDE;
        // Media keys
        else if (key == "VOLUMEUP") vkCode = VK_VOLUME_UP;
        else if (key == "VOLUMEDOWN") vkCode = VK_VOLUME_DOWN;
        else if (key == "VOLUMEMUTE") vkCode = VK_VOLUME_MUTE;
        else if (key == "MEDIANEXT") vkCode = VK_MEDIA_NEXT_TRACK;
        else if (key == "MEDIAPREV") vkCode = VK_MEDIA_PREV_TRACK;
        else if (key == "MEDIAPLAYPAUSE") vkCode = VK_MEDIA_PLAY_PAUSE;
        else if (key == "MEDIASTOP") vkCode = VK_MEDIA_STOP;
    }

    return vkCode != 0 || mouseButton != 0;
}

// Start/register hotkeys
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    StopHotkeyListener();
    idToActionMap.clear();
    mouseKeyMap.clear();

    if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsFunction()) {
        Napi::TypeError::New(env, "Shortcut object and callback function required").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object shortcuts = info[0].As<Napi::Object>();
    Napi::Function callback = info[1].As<Napi::Function>();

    tsfn = Napi::ThreadSafeFunction::New(env, callback, "HotkeyCallback", 0, 1, [](Napi::Env) {});

    struct HotkeyInfo {
        std::string actionName;
        UINT modifiers;
        UINT vkCode;
    };
    std::vector<HotkeyInfo> hotkeysToRegister;
    
    // Parse shortcut configuration
    Napi::Array shortcutNames = shortcuts.GetPropertyNames();
    for (uint32_t i = 0; i < shortcutNames.Length(); i++) {
        Napi::Value key = shortcutNames.Get(i);
        std::string actionName = key.As<Napi::String>().Utf8Value();
        std::string keyString = shortcuts.Get(key).As<Napi::String>().Utf8Value();
        
        UINT vkCode = 0, modifiers = 0, mouseButton = 0;
        if (StringToVk(keyString, vkCode, modifiers, mouseButton)) {
            if (mouseButton != 0) {
                // Mouse side button mapping
                mouseKeyMap[std::make_pair(modifiers, mouseButton)] = actionName;
            } else if (vkCode != 0) {
                // Regular keyboard shortcuts
                hotkeysToRegister.push_back({actionName, modifiers, vkCode});
            }
        }
    }

    // Install mouse hook (if there are mouse shortcuts)
    if (!mouseKeyMap.empty()) {
        mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseHookProc, GetModuleHandle(NULL), 0);
        if (mouseHook) {
            mouseHookRunning = true;
        }
    }

    // Start keyboard shortcut listening thread
    if (!hotkeysToRegister.empty()) {
        isRunning = true;
        hotkeyThread = std::thread([hotkeysToRegister]() {
            hotkeyThreadId = GetCurrentThreadId();
            int nextHotkeyId = 1;
            
            // Register hotkeys
            for (const auto& hotkey : hotkeysToRegister) {
                int id = nextHotkeyId++;
                if (RegisterHotKey(NULL, id, hotkey.modifiers, hotkey.vkCode)) {
                    idToActionMap[id] = hotkey.actionName;
                }
            }

            // Message loop
            MSG msg = {0};
            while (GetMessage(&msg, NULL, 0, 0) != 0) {
                if (msg.message == WM_HOTKEY) {
                    int id = static_cast<int>(msg.wParam);
                    auto it = idToActionMap.find(id);
                    if (it != idToActionMap.end()) {
                        std::string action = it->second;
                        if (tsfn) {
                            tsfn.NonBlockingCall([action](Napi::Env env, Napi::Function jsCallback) {
                                jsCallback.Call({Napi::String::New(env, action)});
                            });
                        }
                    }
                }
            }

            // Clean up registered hotkeys
            for (const auto& pair : idToActionMap) {
                UnregisterHotKey(NULL, pair.first);
            }
        });
        hotkeyThread.detach();
    }
    
    return env.Undefined();
}

// Stop hotkey listener
Napi::Value Stop(const Napi::CallbackInfo& info) {
    StopHotkeyListener();
    return info.Env().Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("start", Napi::Function::New(env, Start));
    exports.Set("stop", Napi::Function::New(env, Stop));
    return exports;
}

NODE_API_MODULE(high_priority_shortcut, Init)