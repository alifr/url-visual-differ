const puppeteer = require('puppeteer');
const looksSame = require('looks-same');
const sanitizeFilename = require('sanitize-filename');
const fs = require('fs-extra');

// Set up folder structure
const outputDirectory = './output'
fs.emptyDirSync(outputDirectory);

const defaultSettings = {
    pathPartial: '/',
    basisPath: 'https://www.cancer.gov',
    altPath: 'localhost:3000',
    outputPath: 'page',
    tolerance: 5,
    widths: [320, 390, 391, 640, 641, 1024, 1025, 1441],
    height: 1, // using fullpage means this is irrelevant but width without height seems to throw in setViewport
    highlightColor: '#DD3300',
    fullPage: true,
    isMobile: false
}

const convertPathToFilename = path => {
    const newPath = path.replace(/\//g, '_');
    const sanitized = sanitizeFilename(newPath);
    return sanitized;
}

const getScreenshot = async (url, page) => {
    await page.goto(url);
    const screenshot = await page.screenshot({
        fullPage: true,
    });
    return screenshot;
}

const diffTwoImages = async (page, width, {
    basisPath,
    altPath,
    pathPartial,
    outputPath,
    highlightColor,
    tolerance,
}) => {
    // get Promise<Buffer>
    const img1 = await getScreenshot(`${basisPath}${pathPartial}`, page)
    const img2 = await getScreenshot(`${altPath}${pathPartial}`, page)

    await looksSame.createDiff({
        reference: img1,
        current: img2,
        diff: `output/${outputPath}__${width}.png`,
        highlightColor,
        tolerance
    }, (err) => {})    

}

const serializePromises = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))

const generateDiffFiles = async (customSettings = {}) => {
    if(customSettings.pathPartial && !customSettings.outputPath) {
        customSettings.outputPath = convertPathToFilename(customSettings.pathPartial);
    }
    const options = Object.assign({}, defaultSettings, customSettings);
    const {
        widths,
        height
    } = options;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // We need to convert the array of widths into a serialized promise chain
    const promises = widths.map(width => async () => {
        await page.setViewport({
            width,
            height
        })
        await diffTwoImages(page, width, options)
    })

    await serializePromises(promises);

    await browser.close();
}


generateDiffFiles();