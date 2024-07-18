const randomUseragent = require('random-useragent');
const Captcha = require("2captcha")
//Enable stealth mode
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const cheerio = require('cheerio');


puppeteer.use(StealthPlugin())

require("dotenv").config();

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const scrapeLogic = async (res) => {
    const solverCaptcha = new Captcha.Solver("8926254c3d44ef13c9eb46d2c56bbad1")
    const userAgent = randomUseragent.getRandom();
    const UA = userAgent || USER_AGENT;


    const browser = await puppeteer.launch({
        args: [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
        ],
        executablePath:
            process.env.NODE_ENV === "production"
                ? process.env.PUPPETEER_EXECUTABLE_PATH
                : puppeteer.executablePath(),
    });
    try {
        const page = await browser.newPage();

        await page.setViewport({
            width: 1920 + Math.floor(Math.random() * 100),
            height: 3000 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false,
        });

        await page.goto("https://consulta.tjpr.jus.br/projudi_consulta/processo/consultaPublica.do?_tj=8a6c53f8698c7ff7826b4c776d71316d3a6b758b3d398283", { waitUntil: 'networkidle2',timeout: 0 });
        await page.setUserAgent(UA);
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(0);
        await page.screenshot({path: 'entrou.png'});
        //Skip images/styles/fonts loading for performance
        await page.setRequestInterception(true);
        // Wait and click on first result
        //const searchResultSelector = "#numeroProcesso";
        //
        //await page.type("#numeroProcesso");
        page.on('dialog', async dialog => {
            await dialog.dismiss();
        });
        await page.waitForSelector('#numeroProcesso');
        await page.type("#numeroProcesso", "00235940520228160017");

        await page.screenshot({path: 'digitou.png'});

        await page.waitForSelector("#captchaImage");
        const element = await page.$("#captchaImage");

        await element.screenshot({
            path: 'captcha.png',
        });

        setTimeout(async()=>{
            const imageBodyBase64 = fs.readFileSync("./captcha.png", "base64");

            const resCaptcha = await solverCaptcha.imageCaptcha(imageBodyBase64);
            const codeCaptcha = resCaptcha.data;

            await page.evaluate((codeCaptcha) => {
              let input = document.querySelector('input[name="answer"]')
              input.value = codeCaptcha;
            },codeCaptcha);

            await page.screenshot({path: 'digitou_captcha.png'});

            await page.click('input[value="Pesquisar"]');

        },2000)

          page.on('request', async(request) => {
                if (request.resourceType() === 'xhr') {
                    if(request.url().indexOf('https://consulta.tjpr.jus.br/projudi_consulta/ajaxUtils.do') > -1){
                      console.log(request.url());
                   }
                }
                request.continue();
            });

            page.on("response", async(response) => {
              const request = response.request();
              // Only check responses for XHR requests and ignore google-analytics
              if (
                request.resourceType() === "xhr" &&
                request.url().includes("/projudi_consulta/ajaxUtils.do")
              ) {
                
                const pData = await response.text();
                const $ = cheerio.load(pData);
                var result = $(".resultTable").find("tbody > tr");

                result.each(async (index, element) => {
                    if(index == 0){
                        const lastMovDate = $($(element).find("td")[2]).text().trim();
                        const lastMovTitle = $($(element).find("td")[3]).text().trim();
                        res.send({
                            lastMovDate,
                            lastMovTitle
                        });
                        }
                        await page.close();
                        await browser.close();
                    });/*
                var dat = result.find('td')[2];
                var moviment = result.find('td')[3];
                console.log({
                    dat,
                    moviment
                });*/
              }
            });
        
        //
    } catch (e) {
        await page.close();
        await browser.close();
        res.send(`Something went wrong while running Puppeteer: ${e}`);
    } finally {
        console.log('finalizou');
    }
};

module.exports = { scrapeLogic };
