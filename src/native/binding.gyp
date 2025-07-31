{
  "targets": [
    {
      "target_name": "high_priority_shortcut",
      "sources": [ "src/high_priority_shortcut.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "libraries": [ ],
      "conditions": [
        ["OS=='win'", {
          "libraries": [ "user32.lib" ]
        }]
      ]
    }
  ]
}
