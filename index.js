import requestPromise from 'request-promise';
import * as cheerio from 'cheerio';
import fs from 'fs'
import moment from 'moment';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'
import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api'

const url = 'https://www.combank.lk/rates-tariff#exchange-rates';
const graph = JSON.parse(fs.readFileSync('graph.json'));
const chatId = "-4052662522"
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN)

const configuration={
  type: 'line',
  data: {
      labels: [],
      datasets: [ {
          label: 'USD Rate',
          data: [],
          borderWidth: 1,
          fill: false,
          borderColor: 'black',
      } ]
  },
  options: {
    layout: {
        padding: 50
    }
  }
};

requestPromise(url)
  .then(async function(html){
    const $ = cheerio.load(html);
    const usdRate = $('#exchange-rates tbody tr:nth-child(1) td:nth-child(6)').first().text().trim()
    const today = moment().startOf('d').format('YYYY-MM-DD')
    const yesterday = moment().startOf('d').subtract(1,'d').format('YYYY-MM-DD')
    const last7nDay = moment().startOf('d').subtract(1,'month').format('YYYY-MM-DD')
    delete graph[last7nDay];
    graph[today] = usdRate

    configuration.data.labels = Object.keys(graph)
    configuration.data.datasets[0].data = Object.values(graph)

    fs.appendFileSync('logs.txt', `${today} : ${usdRate}\n`);
    fs.writeFileSync('graph.json', JSON.stringify(graph,null,4));
    const canvasRenderService= new ChartJSNodeCanvas({
      height: 600,
      width: 800,
      backgroundColour: 'white',
    });
    const imageBuffer= await canvasRenderService.renderToBuffer( configuration );
    fs.writeFileSync( "./image.png", imageBuffer );
    if (graph[yesterday] != graph[today]) {
      const diff = Math.abs(parseFloat(graph[yesterday]) - parseFloat(graph[today]))
      const isItUp = graph[yesterday] < graph[today]
      await bot.sendPhoto(chatId,imageBuffer, {
        'caption': isItUp ? `Good news, everyone! The USD rate has gone up by Rs. ${diff}. It was Rs. ${graph[yesterday]}, and now it's Rs. ${graph[today]}.` : `Sad news, the USD rate has gone down by Rs. ${diff}. It was Rs. ${graph[yesterday]}, and now it's Rs. ${graph[today]}.`
      })
    }
  })
  .catch(function(err){
    console.log(err)
  });