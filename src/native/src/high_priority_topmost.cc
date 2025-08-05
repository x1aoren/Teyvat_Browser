#include <napi.h>
#include <windows.h>
#include <map>
#include <string>
#include <thread>
#include <chrono>

// Global state for window management
std::map<std::string, HWND> trackedWindows;
bool monitoringActive = false;
std::thread monitorThread;

// Enhanced window enumeration callback for finding target windows
BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam) {
    DWORD processId;
    GetWindowThreadProcessId(hwnd, &processId);
    
    // Try both ANSI and Unicode window text
    char windowTextA[512];
    wchar_t windowTextW[512];
    GetWindowTextA(hwnd, windowTextA, sizeof(windowTextA));
    GetWindowTextW(hwnd, windowTextW, sizeof(windowTextW)/sizeof(wchar_t));
    
    char className[256];
    GetClassNameA(hwnd, className, sizeof(className));
    
    // Check if window is visible and has a title
    if (IsWindowVisible(hwnd) && (strlen(windowTextA) > 0 || wcslen(windowTextW) > 0)) {
        std::string* targetTitle = reinterpret_cast<std::string*>(lParam);
        std::string currentTitleA(windowTextA);
        
        // Convert Unicode to UTF-8 for comparison
        std::string currentTitleW;
        if (wcslen(windowTextW) > 0) {
            int utf8Length = WideCharToMultiByte(CP_UTF8, 0, windowTextW, -1, NULL, 0, NULL, NULL);
            if (utf8Length > 0) {
                std::vector<char> utf8Buffer(utf8Length);
                WideCharToMultiByte(CP_UTF8, 0, windowTextW, -1, utf8Buffer.data(), utf8Length, NULL, NULL);
                currentTitleW = std::string(utf8Buffer.data());
            }
        }
        
        // Case-insensitive search for window title (try both ANSI and UTF-8)
        bool foundA = currentTitleA.find(*targetTitle) != std::string::npos;
        bool foundW = !currentTitleW.empty() && currentTitleW.find(*targetTitle) != std::string::npos;
        
        if (foundA || foundW) {
            trackedWindows[*targetTitle] = hwnd;
            return FALSE; // Stop enumeration when found
        }
    }
    
    return TRUE; // Continue enumeration
}

// Function to find window by title (partial match)
HWND FindWindowByTitle(const std::string& titleSubstring) {
    trackedWindows.clear();
    EnumWindows(EnumWindowsProc, reinterpret_cast<LPARAM>(&titleSubstring));
    
    auto it = trackedWindows.find(titleSubstring);
    return (it != trackedWindows.end()) ? it->second : NULL;
}

// Advanced window topmost setting with UIAccess-like behavior
bool SetWindowAlwaysOnTop(HWND hwnd, bool topmost) {
    if (!IsWindow(hwnd)) {
        return false;
    }
    
    HWND insertAfter = topmost ? HWND_TOPMOST : HWND_NOTOPMOST;
    UINT flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;
    
    // First attempt: Standard topmost setting
    bool result = SetWindowPos(hwnd, insertAfter, 0, 0, 0, 0, flags);
    
    if (topmost && result) {
        // Enhanced approach: Force window to stay on top
        // This mimics UIAccess behavior for better fullscreen game compatibility
        
        // Get current window style
        LONG_PTR exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        
        // Add WS_EX_TOPMOST and WS_EX_NOACTIVATE for better compatibility
        exStyle |= WS_EX_TOPMOST | WS_EX_NOACTIVATE;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);
        
        // Force update with multiple attempts for stubborn fullscreen applications
        for (int i = 0; i < 3; i++) {
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, flags);
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        // Additional technique: Set window to system-level priority
        // This helps when dealing with fullscreen games that try to override topmost
        SetWindowPos(hwnd, reinterpret_cast<HWND>(-1), 0, 0, 0, 0, flags);
    }
    
    return result;
}

// Monitor thread function to maintain topmost status against fullscreen applications
void MonitorWindowTopmost(HWND targetWindow) {
    while (monitoringActive && IsWindow(targetWindow)) {
        // Check if window is still topmost
        HWND topWindow = GetTopWindow(GetDesktopWindow());
        bool isOnTop = false;
        
        // Walk through top-level windows to check if our window is among the topmost
        HWND currentWindow = topWindow;
        for (int i = 0; i < 10 && currentWindow; i++) { // Check top 10 windows
            if (currentWindow == targetWindow) {
                isOnTop = true;
                break;
            }
            currentWindow = GetNextWindow(currentWindow, GW_HWNDNEXT);
        }
        
        // If not on top, force it back to top
        if (!isOnTop) {
            SetWindowAlwaysOnTop(targetWindow, true);
        }
        
        // Sleep to prevent excessive CPU usage
        std::this_thread::sleep_for(std::chrono::milliseconds(500));
    }
}

// Start monitoring a window to keep it always on top
Napi::Value StartWindowMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Window title string required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string windowTitle = info[0].As<Napi::String>().Utf8Value();
    
    // Find the target window
    HWND targetWindow = FindWindowByTitle(windowTitle);
    if (!targetWindow) {
        Napi::Error::New(env, "Window not found: " + windowTitle).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Set window to always on top
    bool success = SetWindowAlwaysOnTop(targetWindow, true);
    
    if (success) {
        // Stop any existing monitoring
        monitoringActive = false;
        if (monitorThread.joinable()) {
            monitorThread.join();
        }
        
        // Start new monitoring thread
        monitoringActive = true;
        monitorThread = std::thread(MonitorWindowTopmost, targetWindow);
        monitorThread.detach();
        
        return Napi::Boolean::New(env, true);
    }
    
    return Napi::Boolean::New(env, false);
}

// Stop monitoring and remove topmost status
Napi::Value StopWindowMonitoring(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    monitoringActive = false;
    
    if (monitorThread.joinable()) {
        monitorThread.join();
    }
    
    // Optional: Remove topmost from all tracked windows
    if (info.Length() > 0 && info[0].IsString()) {
        std::string windowTitle = info[0].As<Napi::String>().Utf8Value();
        HWND targetWindow = FindWindowByTitle(windowTitle);
        if (targetWindow) {
            SetWindowAlwaysOnTop(targetWindow, false);
        }
    }
    
    return Napi::Boolean::New(env, true);
}

// Set specific window topmost without monitoring
Napi::Value SetWindowTopmost(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsBoolean()) {
        Napi::TypeError::New(env, "Window title string and boolean topmost flag required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string windowTitle = info[0].As<Napi::String>().Utf8Value();
    bool topmost = info[1].As<Napi::Boolean>().Value();
    
    HWND targetWindow = FindWindowByTitle(windowTitle);
    if (!targetWindow) {
        return Napi::Boolean::New(env, false);
    }
    
    bool success = SetWindowAlwaysOnTop(targetWindow, topmost);
    return Napi::Boolean::New(env, success);
}

// Get list of all visible windows (for debugging)
Napi::Value GetVisibleWindows(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array windowList = Napi::Array::New(env);
    
    struct EnumData {
        Napi::Env env;
        Napi::Array* array;
        uint32_t index;
    };
    
    EnumData enumData = { env, &windowList, 0 };
    
    EnumWindows([](HWND hwnd, LPARAM lParam) -> BOOL {
        EnumData* data = reinterpret_cast<EnumData*>(lParam);
        
        if (IsWindowVisible(hwnd)) {
            // Try both ANSI and Unicode
            char windowTextA[512];
            wchar_t windowTextW[512];
            GetWindowTextA(hwnd, windowTextA, sizeof(windowTextA));
            GetWindowTextW(hwnd, windowTextW, sizeof(windowTextW)/sizeof(wchar_t));
            
            std::string title;
            
            // Prefer Unicode title with UTF-8 conversion
            if (wcslen(windowTextW) > 0) {
                int utf8Length = WideCharToMultiByte(CP_UTF8, 0, windowTextW, -1, NULL, 0, NULL, NULL);
                if (utf8Length > 0) {
                    std::vector<char> utf8Buffer(utf8Length);
                    WideCharToMultiByte(CP_UTF8, 0, windowTextW, -1, utf8Buffer.data(), utf8Length, NULL, NULL);
                    title = std::string(utf8Buffer.data());
                }
            } else if (strlen(windowTextA) > 0) {
                title = std::string(windowTextA);
            }
            
            if (!title.empty()) {
                Napi::Object windowInfo = Napi::Object::New(data->env);
                windowInfo.Set("title", Napi::String::New(data->env, title));
                windowInfo.Set("handle", Napi::Number::New(data->env, reinterpret_cast<uintptr_t>(hwnd)));
                
                data->array->Set(data->index++, windowInfo);
            }
        }
        
        return TRUE;
    }, reinterpret_cast<LPARAM>(&enumData));
    
    return windowList;
}

// Force window to foreground (additional utility function)
Napi::Value BringWindowToForeground(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Window title string required").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string windowTitle = info[0].As<Napi::String>().Utf8Value();
    HWND targetWindow = FindWindowByTitle(windowTitle);
    
    if (!targetWindow) {
        return Napi::Boolean::New(env, false);
    }
    
    // Multiple techniques to bring window to foreground
    bool success = false;
    
    // Method 1: Standard approach
    if (SetForegroundWindow(targetWindow)) {
        success = true;
    }
    
    // Method 2: Alternative approach for stubborn windows
    if (!success) {
        DWORD currentThreadId = GetCurrentThreadId();
        DWORD targetThreadId = GetWindowThreadProcessId(targetWindow, NULL);
        
        AttachThreadInput(currentThreadId, targetThreadId, TRUE);
        SetForegroundWindow(targetWindow);
        AttachThreadInput(currentThreadId, targetThreadId, FALSE);
        success = true;
    }
    
    // Method 3: Force show and activate
    ShowWindow(targetWindow, SW_SHOW);
    SetActiveWindow(targetWindow);
    
    return Napi::Boolean::New(env, success);
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("startWindowMonitoring", Napi::Function::New(env, StartWindowMonitoring));
    exports.Set("stopWindowMonitoring", Napi::Function::New(env, StopWindowMonitoring));
    exports.Set("setWindowTopmost", Napi::Function::New(env, SetWindowTopmost));
    exports.Set("getVisibleWindows", Napi::Function::New(env, GetVisibleWindows));
    exports.Set("bringWindowToForeground", Napi::Function::New(env, BringWindowToForeground));
    
    return exports;
}

NODE_API_MODULE(high_priority_topmost, Init)