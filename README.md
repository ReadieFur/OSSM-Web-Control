# OSSM Web Control
This is a web application that allows you to control your OSSM (Open Source Sex Machine) device over Bluetooth from your browser.  
It is accessible through your browser at [ossm-web.forestpuppy.pet](https://ossm-web.forestpuppy.pet/) or can be installed to your device as a Progressive Web App (PWA) for offline use! *(If your device supports it)*  

### Disclaimer:  
- As per the official OSSM notices, the Bluetooth API is still experimental and may be unsafe, **use this tool at your own risk**, I am not liable for any harm that may occur, you are using this site willingly.  
- There is currently a known issue where if multiple inputs are made in rapid succession, the app may enter an error state. Currently if this is detected the app will signal the OSSM to stop any movement and return to a stable state. A fix for this is being worked on.  

### Contributing:  
Contributions are welcome! If you find any issues or have suggestions for improvements, please open an [issue](https://github.com/ReadieFur/OSSM-Web-Control/issues) or submit a pull request on the [GitHub repository](https://github.com/ReadieFur/OSSM-Web-Control/). The more issues found & fixed, the safer the app will be for everyone!

#### Developer Quickstart
```sh
git clone --recurse-submodules https://github.com/ReadieFur/OSSM-Web-Control.git
cd OSSM-Web-Control
npm install
npm run dev -- --open # Start a development server (and open the app in your default browser)
npm run build # Create a production version of the app
npm run preview # Preview the production build
```
