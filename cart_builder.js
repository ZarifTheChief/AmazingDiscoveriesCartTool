import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import { checkPrime } from 'crypto';
const url = "https://www.amazingmtg.com/";
const card_list = []; 
const card_list_name_only = [];
const cards_added = [];
const cards_added_names_only = [];
const timer = ms => new Promise(res => setTimeout(res, ms));

const chromeEndpointUrl = "ws://127.0.0.1:9222/devtools/browser/be38ce5f-7202-46b1-ab02-a39a0c1c87f5";

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

                    for(let x = 0; x < search_results.length; x++) {
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
                                    let store = el.attributes["data-variant"].value.split(/[:,]/)[1].trim();
                                    let is_gilbert = store === "Gilbert";
                                    let details = {
                                        price: parseFloat(el.attributes["data-price"].value.replace('$', '')),
                                        name: name,
                                        id: el.attributes["data-vid"].value,
                                        set_block: el.attributes["data-category"].value,
                                        store: store,
                                        is_gilbert: is_gilbert
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
                    cards_added_names_only.push(selected_card.name)
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

            // await page.close();
            return resolve();

        } catch(error) {
            return reject(error);
        }
    });
}

await getCardList();
await run();
console.log('Cards Added: ', cards_added)
let cards_added_set = new Set(cards_added_names_only);
let unable_to_add = card_list_name_only.filter(x => !cards_added_names_only.includes(x));
console.log('Unable to Add', unable_to_add)