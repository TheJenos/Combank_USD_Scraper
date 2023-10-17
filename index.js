import requestPromise from 'request-promise';
import * as cheerio from 'cheerio';
import fs from 'fs'
import moment from 'moment';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas'

const url = 'https://www.combank.lk/rates-tariff#exchange-rates';
const graph = JSON.parse(fs.readFileSync('graph.json'));

const configuration={
  type: 'line',
  data: {
      labels: [],
      datasets: [ {
          label: 'USD Rate',
          data: [],
          borderWidth: 1
      } ]
  },
};

requestPromise(url)
  .then(async function(html){
    const $ = cheerio.load(html);
    const usdRate = $('#exchange-rates tbody tr:nth-child(1) td:nth-child(6)').first().text().trim()
    const today = moment().startOf('d').format('YYYY-MM-DD')
    const last7nDay = moment().startOf('d').subtract(7,'d').format('YYYY-MM-DD')
    delete graph[last7nDay];
    graph[today] = usdRate

    configuration.data.labels = Object.keys(graph)
    configuration.data.datasets[0].data = Object.values(graph)

    fs.appendFileSync('logs.txt', `${today} : ${usdRate}\n`);
    fs.writeFileSync('graph.json', JSON.stringify(graph,null,4));
    const canvasRenderService= new ChartJSNodeCanvas({
      height: 600,
      width: 800
    });
    const imageBuffer= await canvasRenderService.renderToBuffer( configuration );
    fs.writeFileSync( "./image.png", imageBuffer );
  })
  .catch(function(err){
    console.log(err)
  });