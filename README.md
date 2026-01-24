[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/sfmc-email-template-quick/bimflcbpdienlgbodpodaaagmdajdnfg)




# SFMC Email & Template QuickSave

> **Product Type:** Google Chrome Browser Extension (Software)<br>
> **License:** Open Source (MIT)<br>
> **Pricing:** Free to use, supported by user contributions.

**SFMC Email & Template QuickSave** is a Google Chrome extension designed to simplify the workflow of Salesforce Marketing Cloud professionals. It allows you to browse, search, and download emails and templates directly from your Content Builder folders without the need for complex API setups or manual copy-pasting.

The tool offers a clean and modern interface for instantly exporting your assets as HTML files or ZIP files.

## Key Features

* **Session Integration**: Automatically detects your active Salesforce Marketing Cloud session and stack, eliminating the need for manual login or API credential configuration.
* **Folder Navigation**: Browse your Content Builder folder structure through an intuitive, lazy-loading tree view that mirrors the platform's hierarchy.
* **Smart Filtering**: Easily filter assets by type, including HTML Emails, Template-Based Emails, and HTML Blocks.
* **Search Functionality**: Quickly find specific assets by name using the real-time search bar.
* **Bulk Download**: Select multiple emails or templates and download them all at once. Single files are downloaded as HTML, while multiple selections are automatically bundled into a ZIP file.
* **Internationalization**: Fully localized interface available in both English (US) and Portuguese (BR), with easy language switching.
* **Modern Interface**: A minimalist design inspired by the Salesforce Lightning Design System for a familiar user experience.

## Installation

To install this open-source extension manually via Developer Mode:

1.  Download or clone this repository to your local machine.
2.  Open Google Chrome and navigate to the extensions management page by typing `chrome://extensions` in the address bar.
3.  Enable **Developer mode** using the toggle switch in the top right corner of the page.
4.  Click the **Load unpacked** button that appears in the top left.
5.  Select the folder where you saved the project files (ensure the folder contains the `manifest.json` file).
6.  The extension should now appear in your browser toolbar.

## How to Use

1.  **Log in to Salesforce Marketing Cloud**: Open your browser and log in to your Marketing Cloud account as you normally would.
2.  **Open the Extension**: Click on the SFMC QuickSave icon in your browser toolbar.
3.  **Browse Content**: The extension will automatically load your Content Builder folders. Click the arrows to expand folders and view their contents.
4.  **Select Assets**: Check the boxes next to the emails or templates you wish to download. You can use the search bar or filters to narrow down your view.
5.  **Download**: Click the **Download Selected** button at the bottom.
    * If you selected one item, it will save as an `.html` file.
    * If you selected multiple items, they will be compressed and saved as a `.zip` file.

## Technical Details

This project is built using standard web technologies:

* **Manifest V3**: Compliant with the latest Chrome Extension security and performance standards.
* **Fuel API**: Interacts directly with Salesforce Marketing Cloud's internal APIs to fetch folder structures and asset content securely.
* **JSZip**: A library used to generate ZIP files on the client side for bulk downloads.
* **Pure JavaScript**: No heavy frameworks were used, ensuring the extension remains lightweight and fast.

## Privacy and Permissions

This extension operates entirely within your browser. It does not store your passwords, access tokens, or asset content on any external server.

* **activeTab**: Required to detect if you are currently on a Salesforce Marketing Cloud tab.
* **storage**: Used to save your language preference locally.
* **downloads**: Required to save the HTML and ZIP files to your computer.
* **host_permissions**: Necessary to communicate with the Salesforce Marketing Cloud endpoints to retrieve your content.

## Support the Project / Apoie o Projeto

This extension is free and open source. If it saves you time, you can support its maintenance.
*Essa extensão é gratuita e open source. Se ela te ajuda, considere apoiar a manutenção.*

### 🌍 International Users
Support via Ko-fi (USD/EUR). Secure and standard for international developers.

[![Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/jolucas245)

### 🇧🇷 Usuários do Brasil
Apoio direto em Reais (BRL) via Pix. Sem taxas internacionais.

[![Apoiar em Reais](https://img.shields.io/badge/Apoiar-R$%20Reais-008cdd?style=for-the-badge&logo=stripe&logoColor=white)](https://livepix.gg/vaquinha/sfmc-quicksave)


## Credits

**Developed by João Ávila**

If you find this tool useful or have suggestions for improvements, feel free to reach out.

[LinkedIn Profile](https://linkedin.com/in/jolucas245)
