import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5175/camera-sample'); await page.locator('canvas').waitFor(); await page.waitForTimeout(1500);await page.screenshot({path:'/home/user/arena-v030-playable-evidence/client/camera-sample.png'}); console.log(errors); await browser.close();