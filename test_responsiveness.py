import asyncio
from playwright.async_api import async_playwright

async def check_overflow(page, viewport_name):
    has_overflow = await page.evaluate('''() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    }''')
    
    overflowing_elements = await page.evaluate('''() => {
        const clientWidth = document.documentElement.clientWidth;
        const elements = document.querySelectorAll('*');
        const overflowing = [];
        
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (['SCRIPT', 'STYLE', 'META', 'HEAD', 'LINK'].includes(el.tagName)) return;
            
            if (rect.right > clientWidth && rect.width > 0) {
                let id = el.id ? '#' + el.id : '';
                let classes = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '';
                let tag = el.tagName.toLowerCase();
                overflowing.push({
                    tag: tag + id + classes,
                    right: rect.right,
                    width: rect.width,
                    clientWidth: clientWidth
                });
            }
        });
        return overflowing;
    }''')
    
    print(f"--- Results for {viewport_name} ---")
    print(f"Has horizontal overflow on body/html: {has_overflow}")
    if overflowing_elements:
        print(f"Found {len(overflowing_elements)} elements extending beyond viewport:")
        for el in overflowing_elements:
            print(f"  - {el['tag']}: right={el['right']}, width={el['width']}, viewport={el['clientWidth']}")
    else:
        print("No elements extending beyond viewport found.")
    print("")

async def main():
    file_path = "file:///home/leo/proyectos/asistencia/index.html"
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # Test Mobile Viewport
        context_mobile = await browser.new_context(
            viewport={'width': 375, 'height': 812},
            is_mobile=True,
            has_touch=True
        )
        page_mobile = await context_mobile.new_page()
        print(f"Navigating to {file_path} on Mobile (375x812)...")
        await page_mobile.goto(file_path)
        await page_mobile.wait_for_timeout(2000)
        await check_overflow(page_mobile, "Mobile (375x812)")
        await context_mobile.close()
        
        # Test Desktop Viewport
        context_desktop = await browser.new_context(
            viewport={'width': 1920, 'height': 1080}
        )
        page_desktop = await context_desktop.new_page()
        print(f"Navigating to {file_path} on Desktop (1920x1080)...")
        await page_desktop.goto(file_path)
        await page_desktop.wait_for_timeout(2000)
        await check_overflow(page_desktop, "Desktop (1920x1080)")
        await context_desktop.close()
        
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
