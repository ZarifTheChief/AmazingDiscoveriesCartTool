# Amazing Discoveries Cart Tool
A tool that take a moxfield decklist and automatically adds them to your cart. 

SETUP
- Ensure Node and NPM are installed on your system
- Get copy of this repo
- CMD Line into the root directory and run "npm install", which will install the one dependency for this project
- Create a shortcut for Chrome on your desktop
- Right click and choose the properties option on your Chrome shortcut
- In the "Target" section, at the end of the string paste: --remote-debugging-port=9222
--- The final output should look as such: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
- In Chrome, go to: http://127.0.0.1:9222/json/version and bookmark this page for later use

HOW TO USE
- Open an instance of Chrome shortcut and keep this open for as long as your running the software
- Go to Bookmarked http://127.0.0.1:9222/json/version
- Copy the "webSocketDebuggerUrl" value
- In the code, paste the value into chromeEndpointUrl const 
- Open the card_list.txt and paste your list
- In command prompt, run command: node cart_builder.js
- sit back and watch
- Once complete, you it will output cards added and cards that were unable to be added to command prompt

The cart is saved in the browser's cache. So you can open up any instance of chrome and the cart will be present. 

LIMITATIONS
- Cannot add Basic Lands
- Software adds a single item per line. If from Moxfield and follows this following format: 3 Access Tunnel (STX) 262; It will parse the "3", however, it currently does nothing with that value.
- This was only tested on a Windows machine... Unsure of MacOS.

FUTURE IMPLEMENTATION
- Show which cards are avaialbe for pickup at designated store
- Converted to a Web App so setup is not required
