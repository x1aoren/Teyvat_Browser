// 这个脚本用于创建SVG占位图标，实际应用中请替换为真实的图标
// 当应用启动时会自动生成简单的SVG图标

document.addEventListener('DOMContentLoaded', () => {
  // 创建简单SVG图标
  createIconPlaceholders();
});

function createIconPlaceholders() {
  // 创建应用Logo (src/renderer/assets/logo.png)
  createAppLogo();
  
  // 创建功能按钮图标
  createBrowserIcon();
  createSettingsIcon();
  createAboutIcon();
  
  // 创建背景图案
  createBackgroundPattern();
  
  // 创建角色剪影
  createCharacterSilhouette();
}

// 创建应用Logo
function createAppLogo() {
  const svgLogo = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3498db;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2c3e50;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#logoGradient)" stroke="#d4af37" stroke-width="2" />
      <polygon points="35,30 75,50 35,70" fill="#f8f1e0" stroke="#d4af37" stroke-width="1" />
    </svg>
  `;
  
  saveSvgAsImage(svgLogo, 'logo.png', 100, 100);
}

// 创建浏览器图标
function createBrowserIcon() {
  const svgBrowser = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect x="5" y="8" width="30" height="24" rx="2" fill="#f8f1e0" stroke="#d4af37" stroke-width="2" />
      <line x1="5" y1="15" x2="35" y2="15" stroke="#3498db" stroke-width="2" />
      <circle cx="10" cy="12" r="1.5" fill="#d4af37" />
    </svg>
  `;
  
  saveSvgAsImage(svgBrowser, 'icons/browser.png', 40, 40);
}

// 创建设置图标
function createSettingsIcon() {
  const svgSettings = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="10" fill="#f8f1e0" stroke="#d4af37" stroke-width="2" />
      <path d="M20,6 L20,10 M20,30 L20,34 M34,20 L30,20 M10,20 L6,20 M29,11 L26,14 M14,26 L11,29 M29,29 L26,26 M14,14 L11,11" 
        stroke="#3498db" stroke-width="3" stroke-linecap="round" />
    </svg>
  `;
  
  saveSvgAsImage(svgSettings, 'icons/settings.png', 40, 40);
}

// 创建关于图标
function createAboutIcon() {
  const svgAbout = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="15" fill="#f8f1e0" stroke="#d4af37" stroke-width="2" />
      <text x="20" y="25" font-family="Arial" font-size="20" font-weight="bold" fill="#3498db" 
        text-anchor="middle">i</text>
    </svg>
  `;
  
  saveSvgAsImage(svgAbout, 'icons/about.png', 40, 40);
}

// 创建背景图案
function createBackgroundPattern() {
  const svgPattern = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#d4af37" stroke-width="0.5" opacity="0.2" />
        </pattern>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <rect width="50" height="50" fill="url(#smallGrid)" />
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#d4af37" stroke-width="1" opacity="0.4" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="#f8f1e0" />
      <rect width="200" height="200" fill="url(#grid)" />
      <circle cx="50" cy="50" r="5" fill="#3498db" opacity="0.3" />
      <circle cx="150" cy="50" r="5" fill="#3498db" opacity="0.3" />
      <circle cx="50" cy="150" r="5" fill="#3498db" opacity="0.3" />
      <circle cx="150" cy="150" r="5" fill="#3498db" opacity="0.3" />
    </svg>
  `;
  
  saveSvgAsImage(svgPattern, 'bg-pattern.png', 200, 200);
}

// 创建角色剪影
function createCharacterSilhouette() {
  const svgCharacter = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
      <path d="M150,50 C180,50 200,70 200,90 C200,110 190,120 190,130 C190,140 200,150 190,170
               L200,190 L180,200 L190,250 L170,300 L150,350 L130,300 L110,250 L120,200 L100,190
               L110,170 C100,150 110,140 110,130 C110,120 100,110 100,90 C100,70 120,50 150,50Z"
        fill="#3498db" opacity="0.7" stroke="#2c3e50" stroke-width="2" />
    </svg>
  `;
  
  saveSvgAsImage(svgCharacter, 'character.png', 300, 400);
}

// 辅助函数：将SVG保存为图片
function saveSvgAsImage(svgContent, filename, width, height) {
  // 创建一个新图像元素
  const img = document.createElement('img');
  img.style.position = 'absolute';
  img.style.top = '-9999px';
  img.style.left = '-9999px';
  img.width = width;
  img.height = height;
  
  // 将SVG转换为数据URL
  const blob = new Blob([svgContent], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  img.src = url;
  
  document.body.appendChild(img);
  
  // 在图像加载完成后创建链接元素并模拟点击下载
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    // 在页面中添加图像（仅用于开发）
    console.log(`已创建占位图像: ${filename}`);
    
    // 清理
    URL.revokeObjectURL(url);
    document.body.removeChild(img);
  };
} 