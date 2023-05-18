import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import express from "express";
import jsrender from 'jsrender';
import bodyParser from 'body-parser';
import {LocalStorage} from 'node-localstorage' 

const app = express();
// import {path} from './dashboard.pug';

const url = "https://www.amazingmtg.com/";
const checkout_url = "https://www.amazingmtg.com/checkout/cart";
const card_list = []; 
const card_list_name_only = [];
const cards_added = [];
const cards_added_names_only = [];
const total_price = 0;
const timer = ms => new Promise(res => setTimeout(res, ms));

const chromeEndpointUrl = "ws://127.0.0.1:9222/devtools/browser/6003fea7-ba70-43ea-ab55-7625c466085f";

class CardToAdd {
    constructor(amount, name){
        this.amount = amount;
        this.name = name;        
    }
};

async function getCardList(){
    let raw_data = await (await fs.readFile("card_list.txt")).toString();
    let data = raw_data.split("\n");
    data.forEach(d => {
        let refined = d.split(/ \(/)[0];
        let amount = refined.substring(0, refined.indexOf(' '));
        let name = refined.substring(refined.indexOf(' ') + 1)
        let card = new CardToAdd(amount, name);
        card_list.push(card);
        card_list_name_only.push(name);
    });
}

async function run(){
    return new Promise(async (resolve, reject) => {
        try {        
            const browser = await puppeteer.connect({
                browserWSEndpoint: chromeEndpointUrl
            });
            // const browser = await puppeteer.launch({headless:false})
            const page = await browser.newPage();
            await page.goto(url);
            await page.exposeFunction("timer", timer);
             
            // DEV TOOL
            page.on('console', msg => {
                for (let i = 0; i < msg.args().length; ++i)
                    console.log(`${msg.args()[i]}`);
              });
            // ==================================================
            for(let a = 0; a < card_list.length; a++){
                let card = card_list[a];
                await page.evaluate(async (card) => {
                    let search_bar = [...document.querySelectorAll('input[name="q"')];
                    search_bar[0].value = card.name;
    
                    let submit_btn = [...document.querySelectorAll('button.search.submit')];
                    await submit_btn[0].click();
                    return Promise.resolve();
                }, card);
    
                await page.waitForSelector('.enable-msrp');
                await page.waitForSelector('form');
                
                let card_details = await page.evaluate(async (card) => {                
                    let search_results = [...document.querySelectorAll('.enable-msrp')];
                    let option_details = [];
                    let gilbert = false;
                    let glendale = false;

                    for(let x = 0; x < search_results.length; x++) {
                        console.log("Searching for card: ", card.name, " " , x+1, " of ", search_results.length)
                        let result = search_results[x];
                        let image = [...result.querySelectorAll(".image")];
                        let href = [...image[0].querySelectorAll("a")][0].href;
                        let valid_card = href.includes("magic_the_gathering-magic_singles");
                        let card_detail = [...result.querySelectorAll("form")];
                        card_detail = card_detail.slice(2);
                        if(valid_card){
                            card_detail.forEach(el => {
                                let name = el.attributes["data-name"].value;
                                if(name.includes(card.name)){
                                    console.log("Added: ", card.name, " ===> ", name)
                                    let store = el.attributes["data-variant"].value.split(/[:,]/)[1].trim();
                                    let is_gilbert = store === "Gilbert";
                                    let is_glendale = store === "Glendale";
                                    let details = {
                                        price: parseFloat(el.attributes["data-price"].value.replace('$', '')),
                                        name: name,
                                        id: el.attributes["data-vid"].value,
                                        set: el.attributes["data-category"].value,
                                        store: store,
                                        is_gilbert: is_gilbert,
                                        is_glendale: is_glendale
                                    };
                                    option_details.push(details);
                                    if(is_gilbert){ gilbert = true }
                                }
                            });
                        }
                    };
                    return Promise.resolve({
                        options: option_details,
                        is_gilbert: gilbert,
                        found: option_details.length > 0
                    });
                }, card);

                if(!card_details.found){
                    break;
                }

                var sorted_details = card_details.options.sort((a,b) => a.price-b.price);
                var low_price = sorted_details[0].price;
                var high_price = sorted_details[sorted_details.length - 1].price;
                    high_price = low_price === high_price ? high_price + .1 : high_price;
                var is_gilbert = card_details.is_gilbert;
                let is_glendale = card_details.is_glendale;
                var selected_card = null;
                var cheapest_option_added = false;
                if(is_gilbert){
                    for(let y=0; y<sorted_details.length; y++){
                        let detail = sorted_details[y];
                        if(detail.is_gilbert && detail.price == low_price){
                            selected_card = detail;
                            cheapest_option_added = true;
                            break;
                        }
                    }
                }
                if(is_gilbert && selected_card == null){
                    for(let y=0; y<sorted_details.length; y++){
                        let detail = sorted_details[y];
                        if(detail.is_gilbert && detail.price < high_price){
                            selected_card = detail;
                            cheapest_option_added = 
                                detail.price === low_price ? true : false;
                            break;
                        }
                    }
                }
                if(is_glendale){
                    for(let y=0; y<sorted_details.length; y++){
                        let detail = sorted_details[y];
                        if(detail.is_glendale && detail.price == low_price){
                            selected_card = detail;
                            cheapest_option_added = true;
                            break;
                        }
                    }
                }
                if(is_glendale && selected_card == null){
                    for(let y=0; y<sorted_details.length; y++){
                        let detail = sorted_details[y];
                        if(detail.is_glendale && detail.price < high_price){
                            selected_card = detail;
                            cheapest_option_added = 
                                detail.price === low_price ? true : false;
                            break;
                        }
                    }
                }
                if(selected_card == null){
                    for(let y=0; y<sorted_details.length; y++){
                        let detail = sorted_details[y];
                        if(detail.price === low_price){
                            selected_card = detail;
                            cheapest_option_added = true;
                            break;
                        }
                    }
                }

                if(selected_card != null){
                    cards_added.push({
                        selected: selected_card,
                        cheapest_option_added: cheapest_option_added
                    });
                    cards_added_names_only.push(card.name)
                }

                for(let z=0; z<cards_added.length; z++){
                    let card = cards_added[z].selected;
                    await page.evaluate(async (card) => {                
                        let search_results = [...document.querySelectorAll('.enable-msrp')];
                        let added_to_cart = false;
                        let added = "";
                        for(let x = 0; x < search_results.length; x++) {
                            if(added_to_cart){
                                break;
                            }
                            let result = search_results[x]
                            let form = result.querySelector(`[data-vid="${card.id}"]`);
                            if(form !== undefined && form !== null){
                                let add_to_cart = form.querySelector('input.utility-button.add-to-cart');
                                await add_to_cart.click();
                                await timer(3000);
                                break;
                            }
                        }
                        return Promise.resolve(added);
                    }, card);
                }
            }

            return resolve();

        } catch(error) {
            return reject(error);
        }
    });
}

 await getCardList();
 await run();







console.log('Cards Added: ', cards_added)
var found_gilbert = [];
var found_glendale = [];
var not_found_selected_store = [];
cards_added.forEach(card => {
    if(card.selected.is_gilbert){
        found_gilbert.push(card.selected.name)
    } else if(card.selected.is_glendale){
        found_glendale.push(card.selected.name)
    }else {
        not_found_selected_store.push(card.selected.name)
    }
})
console.log('Found in Gilbert: ', found_gilbert.length, found_gilbert);
console.log('Found in Glendale: ', found_glendale.length, found_glendale);
console.log('Not Found in Local Stores: ', not_found_selected_store.length, not_found_selected_store)
let unable_to_add = card_list_name_only.filter(x => !cards_added_names_only.includes(x));
console.log('Unable to Add', unable_to_add)

// app.listen(3000);

// // app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'pug')
// app.set('views', './views')
// // LOCAL STORAGE
// var localStorage = new LocalStorage('./added_decks')

// let sample_data = {
//     cards_added_total: 79,
//     cards_to_add_total: 100,
//     local_added_total: 50,
//     cards_added_gilbert_total: 40,
//     cards_added_glendale_total: 10,
//     total_price: 79.95,
//     cards: [
//         {
//             price: 0.8,
//             name: 'Aetherize',
//             id: '86895',
//             set: 'Gatecrash',
//             store: 'Glendale',
//             is_gilbert: false,
//             is_glendale: true
//         },
//         {
//             price: 0.8,
//             name: 'Swords to Plowshare',
//             id: '86895',
//             set: 'Gatecrash',
//             store: 'Casa Grande',
//             is_gilbert: false,
//             is_glendale: true
//         },
//         {
//             price: 0.9,
//             name: 'Victimize',
//             id: '699973',
//             set: 'Commander 2015',
//             store: 'Gilbert',
//             is_gilbert: true,
//             is_glendale: false
//         },
//         {
//             price: 0.9,
//             name: 'Liliana Vess',
//             id: '699973',
//             set: 'Commander 2015',
//             store: 'Casa Grande',
//             is_gilbert: false,
//             is_glendale: true
//         }
//     ]
// };

// app.get("/", (req, res) => {
//     console.log('Sample Data: ', sample_data)
//     res.render('dashboard', { sample_data });
// });

// app.post("/filter", (req, res) => {
//     let filter = req.body.selected_filter;
    
//     let filtered_data = {
//         asdf: false,
//         cards_added_total: 79,
//         cards_to_add_total: 100,
//         local_added_total: 50,
//         cards_added_gilbert_total: 40,
//         cards_added_glendale_total: 10,
//         total_price: 67,
//         data: sample_data.data.filter(d => {
//             if(filter === "gilbert" && d.is_gilbert){
//                 return d;
//             } else if(filter === "glendale" && d.is_glendale){
//                 return d;
//             } else if(filter === "online" && !d.is_gilbert && !d.is_glendale){
//                 return d;
//             } else if (filter === "all"){
//                 return d;
//             }
//         })
//     }
//     let html = template.render(filtered_data);
//     res.send(html);
// });
