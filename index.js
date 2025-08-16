import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import moment from "moment";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";

const cbUrl = "https://www.cbsl.gov.lk/cbsl_custom/charts/usd/indexsmall.php";
const combankUrl = "https://www.combank.lk/rates-tariff#exchange-rates";
const graph = JSON.parse(fs.readFileSync("graph.json"));
const chatId = process.env.TELEGRAM_CHAT_ID || "-1002615908992";
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const configuration = {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Combank USD Rate",
        data: [],
        borderWidth: 1,
        borderColor: "#0000FF",
        backgroundColor: "#0000FF",
        fill: false,
      },
      {
        label: "Cental Bank USD Sell Rate",
        data: [],
        borderWidth: 1,
        borderColor: "#7A7AFF",
        backgroundColor: "#7A7AFF",
        borderDash: [6, 6],
        fill: false,
      },
      {
        label: "Cental Bank USD Buy Rate",
        data: [],
        borderWidth: 1,
        borderColor: "#AAAAFF",
        backgroundColor: "#AAAAFF",
        borderDash: [6, 6],
        fill: false,
      },
    ],
  },
  options: {
    layout: {
      padding: 50,
    },
  },
};

const main = async () => {
  try {
    const [cbHtmlRequest, comHtmlRequest] = await Promise.all([
      axios.get(cbUrl),
      axios.get(combankUrl),
    ]);

    const cbHtml = cbHtmlRequest.data;
    const comHtml = comHtmlRequest.data;

    const cbUsdRates = cheerio.load(cbHtml)("body > div:nth-child(3) > p").text().split('\n');
    const cbUsdBuyRate = cbUsdRates[2].trim().split(' ').map(x => x.trim()).filter(x => x.length > 0)[1];
    const cbUsdSellRate = cbUsdRates[3].trim().split(' ').map(x => x.trim()).filter(x => x.length > 0)[1];
    const comUsdRate = cheerio.load(comHtml)("#exchange-rates tbody tr:nth-child(1) td:nth-child(6)")
      .first()
      .text()
      .trim();

    const today = moment().startOf("d").format("YYYY-MM-DD");
    const yesterday = moment()
      .startOf("d")
      .subtract(1, "d")
      .format("YYYY-MM-DD");
    
    graph[today] = {
      cbUsdBuyRate,
      cbUsdSellRate,
      comUsdRate
    };

    const dates = Object.keys(graph).sort((a,b) => new Date(a).getTime() - new Date(b).getTime())

    if (dates.length > 30) {
      delete graph[dates[0]]
    }

    configuration.data.labels = Object.keys(graph);
    configuration.data.datasets[0].data = Object.values(graph).map(x => x.comUsdRate);
    configuration.data.datasets[1].data = Object.values(graph).map(x => x.cbUsdSellRate);
    configuration.data.datasets[2].data = Object.values(graph).map(x => x.cbUsdBuyRate);

    fs.appendFileSync("logs.txt", `${today},${comUsdRate},${cbUsdSellRate},${cbUsdBuyRate}\n`);
    fs.writeFileSync("graph.json", JSON.stringify(graph, null, 4));
    const canvasRenderService = new ChartJSNodeCanvas({
      height: 600,
      width: 800,
      backgroundColour: "white",
    });
    const imageBuffer = await canvasRenderService.renderToBuffer(configuration);
    fs.writeFileSync("./image.png", imageBuffer);
    if (graph[yesterday].comUsdRate != graph[today].comUsdRate) {
      const diff = Math.abs(
        parseFloat(graph[yesterday].comUsdRate) - parseFloat(graph[today].comUsdRate)
      );
      const isItUp = graph[yesterday].comUsdRate < graph[today].comUsdRate;
      await bot.sendPhoto(chatId, imageBuffer, {
        caption: isItUp
          ? `Good news, everyone! The USD rate has gone up by Rs. ${diff}. It was Rs. ${graph[yesterday].comUsdRate}, and now it's Rs. ${graph[today].comUsdRate}.`
          : `Sad news, the USD rate has gone down by Rs. ${diff}. It was Rs. ${graph[yesterday].comUsdRate}, and now it's Rs. ${graph[today].comUsdRate}.`,
      });
    }
  } catch (error) {
    console.log(error);
  }
};

main();
