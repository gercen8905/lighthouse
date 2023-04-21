const fs = require('fs')
const puppeteer = require('puppeteer')
const lighthouse = require('lighthouse/lighthouse-core/fraggle-rock/api.js')

const waitTillHTMLRendered = async (page, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while(checkCounts++ <= maxChecks){
    let html = await page.content();
    let currentHTMLSize = html.length; 

    let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

    //console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

    if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
      countStableSizeIterations++;
    else 
      countStableSizeIterations = 0; //reset the counter

    if(countStableSizeIterations >= minStableSizeIterations) {
      console.log("Fully Rendered Page: " + page.url());
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }  
};

async function captureReport() {
	const browser = await puppeteer.launch({args: ['--allow-no-sandbox-job', '--allow-sandbox-debugging', '--no-sandbox', '--disable-gpu', '--disable-gpu-sandbox', '--display', '--ignore-certificate-errors', '--disable-storage-reset=true']});
	//const browser = await puppeteer.launch({"headless": false, args: ['--allow-no-sandbox-job', '--allow-sandbox-debugging', '--no-sandbox', '--ignore-certificate-errors', '--disable-storage-reset=true']});
	const page = await browser.newPage();
	const baseURL = "http://localhost/";
	
	await page.setViewport({"width":1920,"height":1080});
	await page.setDefaultTimeout(10000);
	
	const navigationPromise = page.waitForNavigation({timeout: 30000, waitUntil: ['domcontentloaded']});
	await page.goto(baseURL);
    await navigationPromise;

	const flow = await lighthouse.startFlow(page, {
		name: 'shopizer',
		configContext: {
		  settingsOverrides: {
			throttling: {
			  rttMs: 40,
			  throughputKbps: 10240,
			  cpuSlowdownMultiplier: 1,
			  requestLatencyMs: 0,
			  downloadThroughputKbps: 0,
			  uploadThroughputKbps: 0
			},
			throttlingMethod: "simulate",
			screenEmulation: {
			  mobile: false,
			  width: 1920,
			  height: 1080,
			  deviceScaleFactor: 1,
			  disabled: false,
			},
			formFactor: "desktop",
			onlyCategories: ['performance'],
		  },
		},
	});

  	//================================NAVIGATE================================
    await flow.navigate(baseURL, {
		stepName: 'Open Home page'
		});
  	console.log('Home page is opened');
	
	//================================SELECTORS================================
	const tablesTab = "div.main-menu > nav > ul > li:nth-child(2) > a";
    const tableProductCart = "div.product-wrap div a>img";
    const addToCartButton  = ".btn-hover button";
    const cartButton = "button.icon-cart";
	const checkoutButton = "a.default-btn:nth-child(2)";
    const orderDetails = ".your-order-wrap";

	//================================PAGE_ACTIONS================================
	await page.waitForSelector(tablesTab);
	await flow.startTimespan({ stepName: 'Open Tables page' });
		await page.click(tablesTab);
        await waitTillHTMLRendered(page);
		await page.waitForSelector(tableProductCart);
    await flow.endTimespan();
    console.log('Tables page is opened');

	await flow.startTimespan({ stepName: 'Open Table cart' });
		await page.click(tableProductCart);
		await waitTillHTMLRendered(page);
		await page.waitForSelector(addToCartButton);
	await flow.endTimespan();
	console.log('Table cart is opened');

	await flow.startTimespan({ stepName: 'Add Table to cart' });
    	await page.click(addToCartButton);
    	await waitTillHTMLRendered(page);
    	await page.waitForSelector(cartButton);
    await flow.endTimespan();
    console.log('Table is added to cart');

   await flow.startTimespan({ stepName: 'Open Cart' });
        await page.click(cartButton);
        await waitTillHTMLRendered(page);
        await page.waitForSelector(checkoutButton);
        await flow.endTimespan();
    console.log('Cart with order is opened');

    await flow.startTimespan({ stepName: 'Proceed to checkout' });
        await page.click(checkoutButton);
        await waitTillHTMLRendered(page);
        await page.waitForSelector(orderDetails);
        await navigationPromise;
        await flow.endTimespan();
    console.log('Order is opened with details');

	//================================REPORTING================================
	const reportPath = __dirname + '/user-flow.report.html';
	const reportPathJson = __dirname + '/user-flow.report.json';

	const report = await flow.generateReport();
	const reportJson = JSON.stringify(await flow.createFlowResult(), null, 2);
	
	fs.writeFileSync(reportPath, report);
	console.log('Generate html report');
	fs.writeFileSync(reportPathJson, reportJson);
    console.log('Generate json report');

	
    await browser.close();
}
captureReport();