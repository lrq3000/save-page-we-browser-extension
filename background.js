/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Background Page           */
/*                                                                      */
/*      Javascript for Background Page                                  */
/*                                                                      */
/*      Last Edit - 31 Mar 2023                                         */
/*                                                                      */
/*      Copyright (C) 2016-2023 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Refer to Google Chrome developer documentation:                     */
/*                                                                      */
/*  https://developer.chrome.com/extensions/overview                    */
/*  https://developer.chrome.com/extensions/content_scripts             */
/*  https://developer.chrome.com/extensions/messaging                   */
/*  https://developer.chrome.com/extensions/contentSecurityPolicy       */
/*                                                                      */
/*  https://developer.chrome.com/extensions/manifest                    */
/*  https://developer.chrome.com/extensions/declare_permissions         */
/*  https://developer.chrome.com/extensions/match_patterns              */
/*                                                                      */
/*  https://developer.chrome.com/extensions/browserAction               */
/*  https://developer.chrome.com/extensions/contextMenus                */
/*  https://developer.chrome.com/extensions/downloads                   */
/*  https://developer.chrome.com/extensions/notifications               */
/*  https://developer.chrome.com/extensions/runtime                     */
/*  https://developer.chrome.com/extensions/storage                     */
/*  https://developer.chrome.com/extensions/tabs                        */
/*                                                                      */
/*  Refer to IETF data uri and mime type documentation:                 */
/*                                                                      */
/*  RFC 2397 - https://tools.ietf.org/html/rfc2397                      */
/*  RFC 2045 - https://tools.ietf.org/html/rfc2045                      */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Notes on Save Page WE Operation                                     */
/*                                                                      */
/*  1. The basic approach is to identify all frames in the page and     */
/*     then traverse the DOM tree in three passes.                      */
/*                                                                      */
/*  2. The current states of the HTML elements are extracted from       */
/*     the DOM tree. External resources are downloaded and scanned.     */
/*                                                                      */
/*  3. A content script in each frame finds and sets keys on all        */
/*     sub-frame elements that are reachable from that frame.           */
/*                                                                      */
/*  4. The first pass gathers external style sheet resources:           */
/*                                                                      */
/*     - <style> element: find style sheet url()'s in @import rules,    */
/*       then remember locations.                                       */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: find style sheet   */
/*       url()'s in @import rules, then remember locations.             */
/*                                                                      */
/*  5. After the first pass, the referenced external style sheets are   */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  6. The second pass gathers external script/font/image resources:    */
/*                                                                      */
/*     - <script> element: remember location from src attribute.        */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: remember location        */
/*       from href attribute.                                           */
/*                                                                      */
/*     - <img> element: remember location from src attribute.           */
/*                                                                      */
/*     if just saving currently displayed CSS images:                   */
/*                                                                      */
/*     - all elements: find url()'s in CSS computed style for element   */
/*       and for before/after pseudo-elements and remember locations.   */
/*                                                                      */
/*     otherwise, if saving all CSS images:                             */
/*                                                                      */
/*     - style attribute on any element: find image url()'s in CSS      */
/*       rules and remember locations.                                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then find font and      */
/*       image url()'s in CSS rules and remember locations.             */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then find font and image url()'s in CSS rules and       */
/*       remember locations.                                            */
/*                                                                      */
/*  7. After the second pass, the referenced external resources are     */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  8. The third pass generates HTML and data uri's:                    */
/*                                                                      */
/*     - style attribute on any element: replace image url()'s in       */
/*       CSS rules with data uri's.                                     */
/*                                                                      */
/*     - <script> element: Javascript is not changed.                   */
/*                                                                      */
/*     - <script src="..."> element: convert Javascript to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then replace font and   */
/*       image url()'s in CSS rules with data uri's.                    */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then replace font and image url()'s in CSS rules        */
/*       with data uri's, then enclose in new <style> element and       */
/*       replace original <link> element.                               */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: convert icon to data     */
/*       uri and use this to replace url in href attribute.             */
/*                                                                      */
/*     - <base href="..." target="..."> element: remove existing        */
/*       base element (if any) and insert new base element with href    */
/*       attribute set to document.baseURI and target attribute set     */
/*       to the same value as for removed base element (if any).        */
/*                                                                      */
/*     - <body background="..."> element: convert image to data uri     */
/*       and use this to replace url in background attribute.           */
/*                                                                      */
/*     - <img src="..."> element: convert current source image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <img srcset="..."> element: replace list of images in srcset   */
/*       attribute by empty string.                                     */
/*                                                                      */
/*     - <input type="image" src="..."> element: convert image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <input type="file"> or <input type="password"> element:        */
/*       no changes made to maintain security.                          */
/*                                                                      */
/*     - <input type="checkbox"> or <input type="radio"> element:       */
/*       add or remove checked attribute depending on the value of      */
/*       element.checked reflecting any user changes.                   */
/*                                                                      */
/*     - <input type="-other-"> element: add value attribute set to     */
/*       element.value reflecting any user changes.                     */
/*                                                                      */
/*     - <canvas> element: convert graphics to data uri and use this    */
/*       to define background image in style attribute.                 */
/*                                                                      */
/*     - <audio src="..."> element: if current source, convert audio    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video src="..."> element: if current source, convert video    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video poster="..."> element: convert image to data uri and    */
/*       use this to replace url in poster attribute.                   */
/*                                                                      */
/*     - <source src="..."> element in <audio> or <video> element:      */
/*       if current source, convert audio or video to data uri and      */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <source srcset="..."> element in <picture> element: replace    */
/*       list of images in srcset attribute by empty string.            */
/*                                                                      */
/*     - <track src="..."> element: convert subtitles to data uri and   */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <object data="..."> element: convert binary data to data uri   */
/*       and use these to replace url in data attribute.                */
/*                                                                      */
/*     - <embed src="..."> element: convert binary data to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <frame src="..."> element: process sub-tree to extract HTML,   */
/*       then convert HTML to data uri and use this to replace url in   */
/*       src attribute.                                                 */
/*                                                                      */
/*     - <iframe src="..."> or <iframe srcdoc="..."> element: process   */
/*       sub-tree to extract HTML, then convert HTML to text and use    */
/*       this to replace text in srcdoc attribute or to create new      */
/*       srcdoc attribute.                                              */
/*                                                                      */
/*     - <iframe src="..."> element: replace url in srcdoc attribute    */
/*       by empty string.                                               */
/*                                                                      */
/*     - other elements: process child nodes to extract HTML.           */
/*                                                                      */
/*     - text nodes: escape '<' and '>' characters.                     */
/*                                                                      */
/*     - comment nodes: enclose within <!-- and  -->                    */
/*                                                                      */
/*  9. Data URI syntax and defaults:                                    */
/*                                                                      */
/*     - data:[<media type>][;base64],<encoded data>                    */
/*                                                                      */
/*     - where <media type> is: <mime type>[;charset=<charset>]         */
/*                                                                      */
/*     - default for text content: text/plain;charset=US-ASCII          */
/*                                                                      */
/*     - default for binary content: application/octet-stream;base64    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Potential Improvements                                              */
/*                                                                      */
/*  1. The main document and <frame> and <iframe> documents could be    */
/*     downloaded and parsed to extract the original states of the      */
/*     HTML elements, as an alternative to the current states.          */
/*                                                                      */
/*  2. <script src="..."> element could be converted to <script>        */
/*     element to avoid data uri in href attribute, which would also    */
/*     avoid using encodeURIComponent(), but any 'async' or 'defer'     */
/*     attributes would be lost and the order of execution of scripts   */
/*     could change.                                                    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  General Handling of URLs                                            */
/*                                                                      */
/*  HTML                                                                */
/*                                                                      */
/*  1. <a> and <area> elements:                                         */
/*                                                                      */
/*     - absolute and relative URLs with fragment identifiers that      */
/*       point to the same page are converted to fragment-only URLs.    */
/*                                                                      */
/*     - other relative URLs are converted to absolute URLs.            */
/*                                                                      */
/*  2. Other elements: the contents of absolute and relative URLs       */
/*     are saved as data URIs.                                          */
/*                                                                      */
/*  3. Unsaved URLs are converted to absolute URLs.                     */
/*                                                                      */
/*  SVG                                                                 */
/*                                                                      */
/*  1. <a> elements:                                                    */
/*                                                                      */
/*     - absolute and relative URLs with fragment identifiers that      */
/*       point to the same page are converted to fragment-only URLs.    */
/*                                                                      */
/*     - other relative URLs are converted to absolute URLs.            */
/*                                                                      */
/*  2. <image> elements: the contents of absolute and relative URLs     */
/*     are saved as data URIs.                                          */
/*                                                                      */
/*  4. Other elements: the contents of absolute and relative URLs       */
/*     are saved as data URIs.                                          */
/*                                                                      */
/*  5. Unsaved URLs are converted to absolute URLs.                     */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Specific Handling of URLs in HTML and SVG Attributes                */
/*                                                                      */
/*  HTML Element    Attribute    HTML    Content        Handling        */
/*                                                                      */
/*  <a>             href          4 5    -              -               */
/*  <applet>        codebase      4      java           -               */
/*  <area>          href          4 5    -              -               */
/*  <audio>         src             5    audio          data uri   (1)  */
/*  <base>          href          4 5    -              -               */
/*  <blockquote>    cite          4 5    info           -               */
/*  <body>          background    4      image          data uri        */
/*  <button>        formaction      5    -              -               */
/*  <canvas>        -               5    graphics       data uri   (2)  */
/*  <del>           cite          4 5    info           -               */
/*  <embed>         src             5    data           data uri        */
/*  <form>          action        4 5    -              -               */
/*  <frame>         longdesc      4      info           -               */
/*  <frame>         src           4      html           data uri   (3)  */
/*  <head>          profile       4      metadata       -               */
/*  <html>          manifest        5    -              -               */
/*  <iframe>        longdesc      4      info           -               */
/*  <iframe>        src           4 5    html           html text  (4)  */
/*  <iframe>        srcdoc          5    html           html text  (4)  */
/*  <img>           longdesc      4      info           -               */
/*  <img>           src           4 5    image          data uri        */
/*  <img>           srcset          5    images         -          (5)  */
/*  <input>         formaction      5    -              -               */
/*  <input>         src           4 5    image          data uri        */
/*  <ins>           cite          4 5    info           -               */
/*  <link>          href          4 5    css            style      (6)  */
/*  <link>          href          4 5    icon           data uri        */
/*  <object>        archive       4      -              -               */
/*  <object>        classid       4      -              -               */
/*  <object>        codebase      4      -              -               */
/*  <object>        data          4 5    data           data uri        */
/*  <q>             cite          4 5    info           -               */
/*  <script>        src           4 5    javscript      data uri        */
/*  <source>        src             5    audio/video    data uri   (1)  */
/*  <source>        srcset          5    image          -          (5)  */
/*  <track>         src             5    audio/video    data uri        */
/*  <video>         poster          5    image          data uri        */
/*  <video>         src             5    video          data uri   (1)  */
/*                                                                      */
/*  SVG Element     Attribute    SVG     Content        Handling        */
/*                                                                      */
/*  <a>             href        1.1 2    -              -               */
/*  <image>         href        1.1 2    image or svg   data uri        */
/*  other           href        1.1 2    svg            data uri   (7)  */
/*                                                                      */
/*  Notes:                                                              */
/*                                                                      */
/*  (1) data uri is created only if the URL in the 'src' attribute      */
/*      is the same as the URL in element.currentSrc of the related     */
/*      <audio> or <video> element.                                     */
/*                                                                      */
/*  (2) data uri is created by calling element.toDataURL() and is       */
/*      used to define background image in the 'style' attribute.       */
/*                                                                      */
/*  (3) data uri is created by processing the frame's HTML sub-tree.    */
/*      Frame content is usually determined by URL in 'src' attribute,  */
/*      but this is not used directly. Frame content may also have      */
/*      been set programmatically.                                      */
/*                                                                      */
/*  (4) html text is created by processing the frame's HTML sub-tree.   */
/*      URL in 'src' attribute and HTML text in 'srcdoc' attribute      */
/*      determine frame content, but are not used directly; or frame    */
/*      Frame content is usually determined by URL in 'src' attribute   */
/*      and HTML text in 'srcdoc' attribute, but these are not used     */
/*      directly. Frame content may also have been set programmatically.*/
/*                                                                      */
/*  (5) if the URL in element.currentSrc is not the same as the URL     */
/*      in the 'src' attribute, it is assumed to be one of the URLs     */
/*      in the 'srcset' attributes, and the 'src' attribute is set to   */
/*      this URL and the 'srcset' attributes are set to empty strings.  */
/*                                                                      */
/*  (6) replace <link> element with <style> element containing the      */
/*      style sheet referred to by the URL in the 'href' attribute.     */
/*                                                                      */
/*  (7) applies to URLs in 'href' or 'xlink:href' attributes.           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of Binary Data and Characters                              */
/*                                                                      */
/*  1. Files downloaded by XMLHttpRequest GET request are received      */
/*     as a Uint8Array (8-bit unsigned integers) representing:          */
/*     - either binary data (image, font, audio or video)               */
/*     - or encoded characters (style sheets or scripts)                */
/*                                                                      */
/*  2. The Uint8Array is then converted to a Javascript string          */
/*     (16-bit unsigned integers) containing 8-bit unsigned values      */
/*     (a binary string) which is sent to the content script.           */
/*                                                                      */
/*  3. A binary string containing binary data is copied directly        */
/*     into the resourceContent array.                                  */
/*                                                                      */
/*  4. A binary string containing UTF-8 characters is converted to      */
/*     a normal Javascript string (containing UTF-16 characters)        */
/*     before being copied into the resourceContent array.              */
/*                                                                      */
/*  5. A binary string containing non-UTF-8 (ASCII, ANSI, ISO-8859-1)   */
/*     characters is copied directly into the resourceContent array.    */
/*                                                                      */
/*  6. When creating a Base64 data uri, the binary string from the      */
/*     resourceContent array is converted to a Base64 ASCII string      */
/*     using btoa().                                                    */
/*                                                                      */
/*  7. When creating a UTF-8 data uri, the UTF-16 string from the       */
/*     resourceContent array is converted to a UTF-8 %-escaped          */
/*     string using encodeURIComponent(). The following characters      */
/*     are not %-escaped: alphabetic, digits, - _ . ! ~ * ' ( )         */
/*                                                                      */
/*  8. Character encodings are determined as follows:                   */
/*     - UTF-8 Byte Order Mark (BOM) at the start of a text file        */
/*     - charset parameter in the HTTP Content-Type header field        */
/*     - @charset rule at the start of a style sheet                    */
/*     - charset attribute on an element referencing a text file        */
/*     - charset encoding of the parent document or style sheet         */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  IFrames and Frames - Firefox and Chrome Test Results                */
/*                                                                      */
/*                                        Firefox           Chrome      */
/*                                    Loads  cD   dE    Loads  cD   dE  */
/*  <iframe>                                                            */
/*                                                                      */
/*  src="data:..."                     yes   no   no     yes*  no   no  */
/*  src="blob:..."                     yes  yes  yes     yes*  no   no  */
/*                                                                      */
/*  srcdoc="html"                      yes  yes   no     yes  yes  yes  */
/*  srcdoc="html" sandbox=""           yes   no   no     yes   no   no  */
/*  srcdoc="html" sandbox="aso"        yes  yes   no     yes  yes  yes  */
/*                                                                      */
/*  <frame>                                                             */
/*                                                                      */
/*  src="data:..."                     yes   no   no     yes   no   no  */
/*  src="blob:..."                     yes  yes  yes     yes   no   no  */
/*                                                                      */
/*  aso = allow-same-origin                                             */
/*  cD = frame.contentDocument accessible                               */
/*  dE = frame.contentDocument.documentElement accessible               */
/*  yes* = loads but there are issues with <audio> elements             */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Maximum Total Size of Resources - Windows 10 Test Results           */
/*                                                                      */
/*  Browser                Maximum      Limit                           */
/*                                                                      */
/*  Chrome 56 (32-bit)      ~691MB      500MB                           */
/*  Chrome 56 (64-bit)      ~338MB      250MB                           */
/*                                                                      */
/*  Chrome 67 (32-bit)      ~691MB      500MB                           */
/*  Chrome 67 (64-bit)      ~338MB      250MB                           */
/*                                                                      */
/*  Firefox 52 (32-bit)     ~184MB      150MB                           */
/*  Firefox 52 (64-bit)     ~185MB      150MB                           */
/*                                                                      */
/*  Firefox 55 (32-bit)     ~537MB      400MB                           */
/*  Firefox 55 (64-bit)    >1536MB     1000MB                           */
/*                                                                      */
/*  Firefox 62 (32-bit)     ~522MB      400MB                           */
/*  Firefox 62 (64-bit)    >1536MB     1000MB                           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Tab Page Types                                                      */
/*                                                                      */
/*   undefined = Unknown                                                */
/*           0 = Normal Page                                            */
/*           1 = Saved Page                                             */
/*           2 = Saved Page with Resource Loader                        */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Tab Save States                                                     */
/*                                                                      */
/*   undefined = Tab does not exist or URL never committed              */
/*          -4 = URL committed (page loading or loaded)                 */
/*          -3 = Script loading                                         */
/*          -2 = Script loaded (page loaded)                            */
/*          -1 = Operation started                                      */
/*           0 = Lazy Loads                                             */
/*           1 = First Pass                                             */
/*           2 = Second Pass                                            */
/*           3 = Third Pass                                             */
/*           4 = Remove Resource Loader                                 */
/*           5 = Extract Image/Audio/Video                              */
/*           6 = Saved                                                  */
/*           7 = Removed                                                */
/*           8 = Extracted                                              */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;
var ffVersion;
var gcVersion;

var platformOS;
var platformArch;

var printEditId = "";

var mapActions = new Array(0,2,1);

var buttonActionType,buttonActionItems;
var showSubmenu,useNewSaveMethod,showSaveAsDialog,closeTabAfter;
var loadLazyContent,lazyLoadType;
var urlListURLs;
var maxPageTime;
var maxResourceSize;
var maxResourceTime;
var allowPassive;
var crossOrigin;
var useAutomation;

var applyAutomation;

var highlightedCount;

var saveWindowId;
var currentTabId;
var selectedTabIds = new Array();
var listedURLs = new Array();

var tabSaveParams = new Array();

var tabPageTypes = new Array();
var tabSaveStates = new Array();

var saveStateTexts = new Array("Laz","Sav","Sav","Sav","Rm","Ext","Sav","Rm","Ext","");
var saveStateColors = new Array("#606060","#E00000","#A000D0","#0000E0","#A06000","#008000","#A0A0A0","#A0A0A0","#A0A0A0","#000000");

var htmlStrings = new Array();

var cancelSave = false;

var debugEnable = false;

/************************************************************************/

/* Initialize on browser startup */

chrome.runtime.getPlatformInfo(
function(PlatformInfo)   
{
    platformOS = PlatformInfo.os;
    
    chrome.storage.local.set({ "environment-platformos": platformOS });
    
    platformArch = PlatformInfo.arch;
    
    chrome.storage.local.set({ "environment-platformarch": platformArch });
    
    isFirefox = (navigator.userAgent.indexOf("Firefox") >= 0);
    
    chrome.storage.local.set({ "environment-isfirefox": isFirefox });
    
    if (isFirefox)
    {
        chrome.runtime.getBrowserInfo(
        function(info)
        {
            ffVersion = info.version.substr(0,info.version.indexOf("."));
            
            chrome.storage.local.set({ "environment-ffversion": ffVersion });
            
            printEditId = "printedit-we@DW-dev";
            
            initialize();
        });
    }
    else
    {
        gcVersion = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)/)[1];
        
        chrome.management.getSelf(
        function(extensionInfo)
        {
            printEditId = (extensionInfo.installType == "normal") ? "olnblpmehglpcallpnbgmikjblmkopia" : "bhigaknpknggjcoimdncfafkoloiflih";  /* normal or development (unpacked) */
            
            initialize();
        });
    }
});

function initialize()
{
    chrome.storage.local.get(null,
    function(object)
    {
        var title;
        var contexts = new Array();
        
        /* Initialize or migrate options */
        
        /* General options */
        
        if (!("options-compatibility-27.4" in object))  /* for compatibility with previous versions */
        {
            if ("options-lazyloadtype" in object)
            {
                if (object["options-lazyloadtype"] == "2") object["options-lazyloadtype"] = "1";
                else object["options-lazyloadtype"] = "0";
            }
            
            object["options-compatibility-27.4"] = true;
        }
        
        if (!("options-buttonactiontype" in object)) object["options-buttonactiontype"] = 0;
        
        if (!("options-buttonactionitems" in object)) object["options-buttonactionitems"] = 1;
        
        if (!("options-showsubmenu" in object)) object["options-showsubmenu"] =
            ("options-showmenuitem" in object) ? object["options-showmenuitem"] : true;  /* Version 3.0-5.0 */
        
        if (!("options-showwarning" in object)) object["options-showwarning"] = true;
        
        if (!("options-showresources" in object)) object["options-showresources"] =
            ("options-showurllist" in object) ? object["options-showurllist"] : false;  /* Version 7.5-17.3 */
            
        if (!("options-promptcomments" in object)) object["options-promptcomments"] = false;
        
        if (!("options-skipwarningscomments" in object)) object["options-skipwarningscomments"] = true;
        
        if (!("options-usenewsavemethod" in object)) object["options-usenewsavemethod"] = false;
        
        if (!("options-showsaveasdialog" in object)) object["options-showsaveasdialog"] = false;
        
        if (!("options-closetabafter" in object)) object["options-closetabafter"] = false;
        
        if (!("options-loadlazycontent" in object)) object["options-loadlazycontent"] = 
            ("options-forcelazyloads" in object) ? object["options-forcelazyloads"] : false;  /* Version 13.0-24.2 */
        
        if (!("options-lazyloadtype" in object)) object["options-lazyloadtype"] = 0;
        
        if (!("options-loadlazyimages" in object)) object["options-loadlazyimages"] = true;
        
        if (!("options-retaincrossframes" in object)) object["options-retaincrossframes"] = true;
        
        if (!("options-mergecssimages" in object)) object["options-mergecssimages"] = true;
        
        if (!("options-executescripts" in object)) object["options-executescripts"] = false;

        if (!("options-removeunsavedurls" in object)) object["options-removeunsavedurls"] = true;
        
        if (!("options-removeelements" in object)) object["options-removeelements"] =
            ("options-purgeelements" in object) ? object["options-purgeelements"] : false;  /* Version 13.2-20.1 */
        
        if (!("options-rehideelements" in object)) object["options-rehideelements"] = false;
        
        if (!("options-includeinfobar" in object)) object["options-includeinfobar"] =
            ("options-includenotification" in object) ? object["options-includenotification"] : false;  /* Version 7.4 */
        
        if (!("options-includesummary" in object)) object["options-includesummary"] = false;
        
        if (!("options-formathtml" in object)) object["options-formathtml"] = false;
        
        /* Saved Items options */
        
        if (!("options-savehtmlimagesall" in object)) object["options-savehtmlimagesall"] =
            ("options-saveallhtmlimages" in object) ? object["options-saveallhtmlimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savehtmlaudiovideo" in object)) object["options-savehtmlaudiovideo"] = false;
        
        if (!("options-savehtmlobjectembed" in object)) object["options-savehtmlobjectembed"] = false;
        
        if (!("options-savecssimagesall" in object)) object["options-savecssimagesall"] =
            ("options-saveallcssimages" in object) ? object["options-saveallcssimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savecssfontswoff" in object)) object["options-savecssfontswoff"] =
            ("options-saveallcustomfonts" in object) ? object["options-saveallcustomfonts"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savecssfontsall" in object)) object["options-savecssfontsall"] = false;
        
        if (!("options-savescripts" in object)) object["options-savescripts"] =
            ("options-saveallscripts" in object) ? object["options-saveallscripts"] : false;  /* Version 2.0-3.0 */
        
        /* File Info options */
        
        if (!("options-urllisturls" in object)) object["options-urllisturls"] = new Array();
        
        if (!("options-urllistname" in object)) object["options-urllistname"] = "";
        
        if (!("options-savedfilename" in object)) object["options-savedfilename"] = "%TITLE%";
        
        if (!("options-replacespaces" in object)) object["options-replacespaces"] = false;
        
        if (!("options-replacechar" in object)) object["options-replacechar"] = "-";
        
        if (!("options-maxfilenamelength" in object)) object["options-maxfilenamelength"] = 150;
        
        /* Advanced options */
        
        if (!("options-maxpagetime" in object)) object["options-maxpagetime"] = 10;
        
        if (!("options-savedelaytime" in object)) object["options-savedelaytime"] = 0;
        
        if (!("options-lazyloadscrolltime" in object)) object["options-lazyloadscrolltime"] =
            ("options-lazyloadsscrolltime" in object) ? object["options-lazyloadsscrolltime"] : 0.2;  /* Version 24.0-24.2 */
        
        if (!("options-lazyloadshrinktime" in object)) object["options-lazyloadshrinktime"] =
            ("options-lazyloadsshrinktime" in object) ? object["options-lazyloadsshrinktime"] : 0.5;  /* Version 24.0-24.2 */
        
        if (!("options-maxframedepth" in object)) object["options-maxframedepth"] =
            ("options-saveframedepth" in object) ? object["options-saveframedepth"] : 5;  /* Version 2.0-2.1 */
        
        if (!("options-maxresourcesize" in object)) object["options-maxresourcesize"] = 50;
        
        if (!("options-maxresourcetime" in object)) object["options-maxresourcetime"] =
            ("options-resourcetimeout" in object) ? object["options-resourcetimeout"] : 10;  /* Version 9.0-9.1 */
        
        if (!("options-allowpassive" in object)) object["options-allowpassive"] = false;
        
        if (!("options-crossorigin" in object)) object["options-crossorigin"] = 0;
        
        if (!("options-useautomation" in object)) object["options-useautomation"] = false;
        
        if (!("options-maxframedepth-9.0" in object))
        {
            object["options-maxframedepth"] = 5;
            object["options-maxframedepth-9.0"] = true;
        }
        
        /* Update stored options */
        
        chrome.storage.local.set(object);
        
        /* Initialize local options */
        
        buttonActionType = object["options-buttonactiontype"];
        
        buttonActionItems = object["options-buttonactionitems"];
        
        showSubmenu = object["options-showsubmenu"];
        
        useNewSaveMethod = object["options-usenewsavemethod"];
        
        showSaveAsDialog = object["options-showsaveasdialog"];
        
        closeTabAfter = object["options-closetabafter"];
        
        loadLazyContent = object["options-loadlazycontent"];
        
        lazyLoadType = object["options-lazyloadtype"];
        
        urlListURLs = object["options-urllisturls"];
        
        maxPageTime = object["options-maxpagetime"];
        
        maxResourceSize = object["options-maxresourcesize"];
        
        maxResourceTime = object["options-maxresourcetime"];
        
        allowPassive = object["options-allowpassive"];
        
        crossOrigin = object["options-crossorigin"];
        
        useAutomation = object["options-useautomation"];
        
        applyAutomation = useAutomation;
        
        /* Create context menu items */
        
        contexts = showSubmenu ? [ "all" ] : [ "browser_action" ];
        title = loadLazyContent ? "Without " : "With ";
        title += (lazyLoadType == "0") ? "Scroll:" : "Shrink:";
        
        chrome.contextMenus.create({ id: "saveselectedtabs", title: "Save Selected Tabs", contexts: contexts, enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls", title: "Save Listed URLs", contexts: contexts, enabled: true });
        chrome.contextMenus.create({ id: "cancelsave", title: "Cancel Save", contexts: contexts, enabled: true });
        chrome.contextMenus.create({ id: "viewpageinfo", title: "View Saved Page Info", contexts: contexts, enabled: true });
        chrome.contextMenus.create({ id: "removeresourceloader", title: "Remove Resource Loader", contexts: contexts, enabled: true });
        chrome.contextMenus.create({ id: "extractmedia", title: "Extract Image/Audio/Video", contexts: [ "image","audio","video" ], enabled: true });
        
        chrome.contextMenus.create({ id: "saveselectedtabs-basicitems", parentId: "saveselectedtabs", title: "Basic Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "saveselectedtabs-standarditems", parentId: "saveselectedtabs", title: "Standard Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "saveselectedtabs-customitems", parentId: "saveselectedtabs", title: "Custom Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ type: "separator", parentId: "saveselectedtabs", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "saveselectedtabs-w-title", parentId: "saveselectedtabs", title: title, contexts: [ "all" ], enabled: false });
        chrome.contextMenus.create({ id: "saveselectedtabs-w-basicitems", parentId: "saveselectedtabs", title: "Basic Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "saveselectedtabs-w-standarditems", parentId: "saveselectedtabs", title: "Standard Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "saveselectedtabs-w-customitems", parentId: "saveselectedtabs", title: "Custom Items", contexts: [ "all" ], enabled: true });
        
        chrome.contextMenus.create({ id: "savelistedurls-basicitems", parentId: "savelistedurls", title: "Basic Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls-standarditems", parentId: "savelistedurls", title: "Standard Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls-customitems", parentId: "savelistedurls", title: "Custom Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ type: "separator", parentId: "savelistedurls", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls-w-title", parentId: "savelistedurls", title: title, contexts: [ "all" ], enabled: false });
        chrome.contextMenus.create({ id: "savelistedurls-w-basicitems", parentId: "savelistedurls", title: "Basic Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls-w-standarditems", parentId: "savelistedurls", title: "Standard Items", contexts: [ "all" ], enabled: true });
        chrome.contextMenus.create({ id: "savelistedurls-w-customitems", parentId: "savelistedurls", title: "Custom Items", contexts: [ "all" ], enabled: true });
        
        /* Update browser action and context menus for first tab */
        /* Perform Button Action on browser startup */
        
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            /* Initialize states for first tab */
            
            if (!specialPage(tabs[0].url))
            {
                chrome.tabs.executeScript(tabs[0].id,{ code: "(document.querySelector(\"script[id='savepage-pageloader']\") != null || " +  /* Version 7.0-14.0 */
                                                             " document.querySelector(\"meta[name='savepage-resourceloader']\") != null) ? 2 : " +  /* Version 15.0 - 15.1 */
                                                             " document.querySelector(\"meta[name='savepage-url']\") != null ? 1 : 0", frameId: 0 },
                function(pagetype)
                {
                    tabPageTypes[tabs[0].id] = pagetype;
                    tabSaveStates[tabs[0].id] = -4;
                    
                    updateBrowserAction(tabs[0].id,tabs[0].url);
                    
                    updateContextMenus();
                });
            }
            else  /* special page */
            {
                tabPageTypes[tabs[0].id] = 0;
                tabSaveStates[tabs[0].id] = -4;
                
                updateBrowserAction(tabs[0].id,tabs[0].url);
                
                updateContextMenus();
            }
            
            /* Automatic save on startup */
            
            if (applyAutomation)
            {
                initiateAction(buttonActionType,buttonActionItems,false,null,false,false);
            }
        });
        
        /* Add listeners */
        
        addListeners();
    });
}

/************************************************************************/

/* Add listeners */

function addListeners()
{
    /* Storage changed listener */
    
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        if ("options-buttonactiontype" in changes) buttonActionType = changes["options-buttonactiontype"].newValue;
        
        if ("options-buttonactionitems" in changes) buttonActionItems = changes["options-buttonactionitems"].newValue;
        
        if ("options-showsubmenu" in changes) showSubmenu = changes["options-showsubmenu"].newValue;
        
        if ("options-usenewsavemethod" in changes) useNewSaveMethod = changes["options-usenewsavemethod"].newValue;
        
        if ("options-showsaveasdialog" in changes) showSaveAsDialog = changes["options-showsaveasdialog"].newValue;
        
        if ("options-closetabafter" in changes) closeTabAfter = changes["options-closetabafter"].newValue;
        
        if ("options-loadlazycontent" in changes) loadLazyContent = changes["options-loadlazycontent"].newValue;
        
        if ("options-lazyloadtype" in changes) lazyLoadType = changes["options-lazyloadtype"].newValue;
        
        if ("options-urllisturls" in changes) urlListURLs = changes["options-urllisturls"].newValue;
        
        if ("options-maxpagetime" in changes) maxPageTime = changes["options-maxpagetime"].newValue;
        
        if ("options-maxresourcesize" in changes) maxResourceSize = changes["options-maxresourcesize"].newValue;
        
        if ("options-maxresourcetime" in changes) maxResourceTime = changes["options-maxresourcetime"].newValue;
        
        if ("options-allowpassive" in changes) allowPassive = changes["options-allowpassive"].newValue;
        
        if ("options-crossorigin" in changes) crossOrigin = changes["options-crossorigin"].newValue;
        
        if ("options-buttonactiontype" in changes || "options-showsubmenu" in changes || "options-urllisturls" in changes)
        {
            chrome.tabs.query({ lastFocusedWindow: true, active: true },
            function(tabs)
            {
                updateBrowserAction(tabs[0].id,tabs[0].url);
                
                updateContextMenus();
            });
        }
    });
    
    /* Browser action listener */
    
    chrome.browserAction.onClicked.addListener(
    function(tab)
    {
        initiateAction(buttonActionType,buttonActionItems,false,null,false,false);
    });
    
    /* Keyboard command listener */
    
    chrome.commands.onCommand.addListener(
    function(command)
    {
        if (command == "cancelsave")
        {
            cancelAction();
        }
    });
    
    /* Context menu listener */
    
    chrome.contextMenus.onClicked.addListener(
    function(info,tab)
    {
        if (info.menuItemId == "saveselectedtabs-basicitems") initiateAction(0,0,false,null,false,false);
        else if (info.menuItemId == "saveselectedtabs-standarditems") initiateAction(0,1,false,null,false,false);
        else if (info.menuItemId == "saveselectedtabs-customitems") initiateAction(0,2,false,null,false,false);
        else if (info.menuItemId == "saveselectedtabs-w-basicitems") initiateAction(0,0,true,null,false,false);
        else if (info.menuItemId == "saveselectedtabs-w-standarditems") initiateAction(0,1,true,null,false,false);
        else if (info.menuItemId == "saveselectedtabs-w-customitems") initiateAction(0,2,true,null,false,false);
        else if (info.menuItemId == "savelistedurls-basicitems") initiateAction(1,0,false,null,false,false);
        else if (info.menuItemId == "savelistedurls-standarditems") initiateAction(1,1,false,null,false,false);
        else if (info.menuItemId == "savelistedurls-customitems") initiateAction(1,2,false,null,false,false);
        else if (info.menuItemId == "savelistedurls-w-basicitems") initiateAction(1,0,true,null,false,false);
        else if (info.menuItemId == "savelistedurls-w-standarditems") initiateAction(1,1,true,null,false,false);
        else if (info.menuItemId == "savelistedurls-w-customitems") initiateAction(1,2,true,null,false,false);
        else if (info.menuItemId == "cancelsave") cancelAction();
        else if (info.menuItemId == "viewpageinfo") initiateAction(2,null,null,null,false,false);
        else if (info.menuItemId == "removeresourceloader") initiateAction(3,null,null,null,false,false);
        else if (info.menuItemId == "extractmedia") initiateAction(4,null,null,info.srcUrl,false,false);
    });
    
    /* Tab event listeners */
    
    chrome.tabs.onActivated.addListener(  /* tab selected */
    function(activeInfo)
    {
        chrome.tabs.get(activeInfo.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* in case tab does not exist */
            {
                updateBrowserAction(tab.id,tab.url);
                
                updateContextMenus();
            }
        });
    });
    
    chrome.tabs.onHighlighted.addListener(  /* tab highlighted */
    function(highlightInfo)
    {
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            highlightedCount = highlightInfo.tabIds.length;
            
            updateBrowserAction(tabs[0].id,tabs[0].url);
            
            updateContextMenus();
        });
    });
    
    chrome.tabs.onUpdated.addListener(  /* URL updated */
    function(tabId,changeInfo,tab)
    {
        updateBrowserAction(tab.id,tab.url);
        
        updateContextMenus();
    });
    
    /* Web navigation listeners */
    
    chrome.webNavigation.onCommitted.addListener(
    function(details)
    {
        if (details.frameId == 0)
        {
            tabPageTypes[details.tabId] = 0;
            tabSaveStates[details.tabId] = -4;
            
            updateBrowserAction(details.tabId,details.url);
            
            updateContextMenus();
        }
    });
    
    chrome.webNavigation.onCompleted.addListener(  /* page loaded or (Firefox) extracted resource downloaded */
    function(details)
    {
        /* Firefox - listener called as if page load when download popup window opens - see Bug 1441474 */
        
        chrome.tabs.get(details.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* in case tab does not exist */
            {
                if (details.frameId == 0 && details.url != tab.url) return;  /* Firefox - workaround for when download popup window opens */
                
                if (details.frameId == 0)
                {
                    if (!specialPage(details.url))
                    {
                        chrome.tabs.executeScript(details.tabId,{ code: "(document.querySelector(\"script[id='savepage-pageloader']\") != null || " +  /* Version 7.0-14.0 */
                                                                        " document.querySelector(\"meta[name='savepage-resourceloader']\") != null) ? 2 : " +  /* Version 15.0 - 15.1 */
                                                                        " document.querySelector(\"meta[name='savepage-url']\") != null ? 1 : 0", frameId: 0 },
                        function(pagetype)
                        {
                            tabPageTypes[details.tabId] = pagetype;
                            tabSaveStates[details.tabId] = -4;
                            
                            updateBrowserAction(details.tabId,details.url);
                            
                            updateContextMenus();
                        });
                    }
                    else  /* special page */
                    {
                        tabPageTypes[details.tabId] = 0;
                        tabSaveStates[details.tabId] = -4;
                        
                        updateBrowserAction(details.tabId,details.url);
                        
                        updateContextMenus();
                    }
                }
            }
        });
    });
    
    /* Message received listener */
    
    chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse)
    {
        var htmlBlob,objectURL;
        
        switch (message.type)
        {
            /* Messages from content script */
            
            case "delay":
                
                window.setTimeout(function() { sendResponse(); },message.milliseconds);
                
                return true;  /* asynchronous response */
                
            case "scriptLoaded":
                
                tabSaveStates[sender.tab.id] = -2;

                updateBrowserAction(sender.tab.id,sender.tab.url);
                
                updateContextMenus();
                
                tabSaveStates[sender.tab.id] = -1;
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "performAction",
                                                        menuaction: tabSaveParams[sender.tab.id].menuaction,
                                                        saveditems: tabSaveParams[sender.tab.id].saveditems,
                                                        togglelazy: tabSaveParams[sender.tab.id].togglelazy,
                                                        extractsrcurl: tabSaveParams[sender.tab.id].extractsrcurl,
                                                        externalsave: tabSaveParams[sender.tab.id].externalsave,
                                                        swapdevices: tabSaveParams[sender.tab.id].swapdevices,
                                                        multiplesaves: tabSaveParams[sender.tab.id].multiplesaves,
                                                        csprestriction: tabSaveParams[sender.tab.id].csprestriction },checkError);
                
                break;
                
            case "setPageType":
                
                tabPageTypes[sender.tab.id] = message.pagetype;
                
                updateBrowserAction(sender.tab.id,sender.tab.url);
                
                updateContextMenus();
                
                break;
                
            case "setSaveState":
                
                tabSaveStates[sender.tab.id] = message.savestate;
                
                updateBrowserAction(sender.tab.id,sender.tab.url);
                
                updateContextMenus();
                
                break;
                
            case "requestFrames":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "requestFrames" },checkError);
                
                break;
                
            case "replyFrame":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "replyFrame", key: message.key, url: message.url, html: message.html, fonts: message.fonts },checkError);
                
                break;
                
            case "loadResource":
                
                chrome.tabs.get(sender.tab.id,
                function(tab)
                {
                    /* Verify message sender */
                    
                    if (sender.id == chrome.runtime.id && sender.frameId == 0 && sender.url == tab.url &&
                        (isFirefox || sender.origin == (new URL(tab.url)).origin))  /* Firefox - sender.origin is not available */
                    {
                        loadResource(sender.tab.id,message.index,message.location,message.referrer,message.referrerPolicy);
                    }
                    else
                    {
                        chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "ignored*" },checkError);
                    }
                });
                
                break;
                
            case "selectTab":
                
                chrome.tabs.update(sender.tab.id,{ active: true });
                
                break;
                
            case "saveExit":
                
                tabSaveStates[sender.tab.id] = -2;
                
                updateBrowserAction(sender.tab.id,sender.tab.url);
                
                updateContextMenus();
                
                finishAction(sender.tab.id,false);
                
                break;
                
            case "waitBeforeRevoke":
                
                window.setTimeout(
                function(tabId)
                {
                    chrome.tabs.sendMessage(tabId,{ type: "nowRevokeObject" },checkError);
                },100,sender.tab.id);
                
                break;
                
            case "saveDone":
                
                tabSaveStates[sender.tab.id] = 6;
                
                updateBrowserAction(sender.tab.id,sender.tab.url);
                
                updateContextMenus();
                
                finishAction(sender.tab.id,true);
                
                break;
                
            case "transferString":
                
                if (message.htmlindex == 0) htmlStrings.length = 0;
                
                htmlStrings[message.htmlindex] = message.htmlstring;
                
                break;
                
            case "savePage":
                
                /* Convert HTML strings to HTML blob */
                
                htmlBlob = new Blob( htmlStrings, { type : "text/html" });
                
                objectURL = window.URL.createObjectURL(htmlBlob);
                
                htmlBlob = null;
                
                htmlStrings.length = 0;
                
                /* Download HTML blob as .html file */
                
                chrome.downloads.onChanged.addListener(onChangedCallback);
                
                function onChangedCallback(downloadDelta)
                {
                    if (downloadDelta.error && downloadDelta.error.current == "USER_CANCELED")  /* Chrome */
                    {
                        downloadDone(false);
                    }
                    else if (downloadDelta.state && downloadDelta.state.current == "interrupted")
                    {
                        alertNotify("Saving of page was interrupted:\n > " + sender.tab.title);
                        
                        downloadDone(false);
                    }
                    else if (downloadDelta.state && downloadDelta.state.current == "complete")
                    {
                        downloadDone(true);
                    }
                }
                
                if (isFirefox && ffVersion >= 57)
                {
                    chrome.downloads.download({ url: objectURL, filename: message.filename, saveAs: showSaveAsDialog ? true : null, incognito: sender.tab.incognito },
                    function(downloadItemId)
                    {
                        if (chrome.runtime.lastError != null && chrome.runtime.lastError.message == "Download canceled by the user")  /* Firefox */
                        {
                            downloadDone(false);
                        }
                    });
                }
                else chrome.downloads.download({ url: objectURL, filename: message.filename, saveAs: showSaveAsDialog ? true : null });
                
                function downloadDone(success)
                {
                    chrome.downloads.onChanged.removeListener(onChangedCallback);
                    
                    window.URL.revokeObjectURL(objectURL);
                    
                    tabSaveStates[sender.tab.id] = 6;
                    
                    updateBrowserAction(sender.tab.id,sender.tab.url);
                    
                    updateContextMenus();
                    
                    finishAction(sender.tab.id,success);
                }
                
                break;
        }
    });
    
    /* External message received listener */
    
    if (!isFirefox || ffVersion >= 54)
    {
        chrome.runtime.onMessageExternal.addListener(
        function(message,sender,sendResponse)
        {
            switch (message.type)
            {
                /* Messages from another add-on */
                
                case "externalSaveStart":
                    
                    if (sender.id == printEditId)
                    {
                        sendResponse({ });
                        
                        if (message.action <= 2)  /* saved items */
                        {
                            chrome.tabs.query({ lastFocusedWindow: true, active: true },
                            function(tabs)
                            {
                                initiateAction(0,message.action,false,null,true,message.swapdevices);
                            });
                        }
                        else
                        {
                            chrome.runtime.sendMessage(printEditId,{ type: "externalSaveDone", tabid: sender.tab.id, success: false },checkError);
                        }
                    }
                    
                    break;
                    
                case "externalSaveCheck":
                    
                    if (sender.id == printEditId)
                    {
                        sendResponse({ });
                    }
                    
                    break;
            }
        });
    }
}

/************************************************************************/

/* Load resource function */

async function loadResource(tabid,index,location,referrer,referrerPolicy)
{
    var controller,timeout,response;
    var i,contentType,contentLength,mimetype,charset,buffer,byteArray,binaryString;
    var matches = [];
    
    controller = new AbortController();
    
    timeout = window.setTimeout(
    function()
    {
        controller.abort();
    },maxResourceTime*1000);
    
    try  /* load in background script */
    {
        response = await fetch(location,{ method: "GET", mode: "cors", cache: "no-cache", referrer: referrer, referrerPolicy: referrerPolicy, signal: controller.signal });
        
        if (debugEnable) console.log("Backgrond Fetch - index: " + index + " - status: " + response.status + " - referrer: " + referrer + " - policy: " + referrerPolicy + " - location: " + location);
        
        window.clearTimeout(timeout);
        
        if (response.status == 200)
        {
            contentType = response.headers.get("Content-Type");
            if (contentType == null) contentType = "";
            
            contentLength = +response.headers.get("Content-Length");
            if (contentLength == null) contentLength = 0;
            
            if (contentLength > maxResourceSize*1024*1024)
            {
                chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "maxsize*" },checkError);
            }
            else
            {
                matches = contentType.match(/([^;]+)/i);
                if (matches != null) mimetype = matches[1].toLowerCase();
                else mimetype = "";
                
                matches = contentType.match(/;charset=([^;]+)/i);
                if (matches != null) charset = matches[1].toLowerCase();
                else charset = "";
                
                if (mimetype != "text/css" && mimetype != "image/vnd.microsoft.icon" && 
                    mimetype.substr(0,6) != "image/" && mimetype.substr(0,6) != "audio/" && mimetype.substr(0,6) != "video/")
                {
                    /* Block potentially unsafe resource */
                    
                    chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "blocked*" },checkError);
                    
                    if (debugEnable) console.log("Background Fetch Blocked - index: " + index + " mimetype: " + mimetype + " - location: " + location);
                }
                else
                {
                    buffer = await response.arrayBuffer();
                    
                    byteArray = new Uint8Array(buffer);
                    
                    binaryString = "";
                    for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
                    
                    chrome.tabs.sendMessage(tabid,{ type: "loadSuccess", index: index, reason: "*", content: binaryString, mimetype: mimetype, charset: charset },checkError);
                }
            }
        }
        else
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "load:" + response.status + "*" },checkError);
        }
    }
    catch (e)
    {
        window.clearTimeout(timeout);
        
        if (e.name == "AbortError")
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "maxtime*" },checkError);
        }
        else
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "fetcherr*" },checkError);
        }
    }
}

/************************************************************************/

/* Initiate/Next/Perform/Finish/Cancel action functions */

function initiateAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices)
{
    chrome.windows.getLastFocused({ },
    function(win)
    {
        saveWindowId = win.id;
        
        chrome.tabs.query({ windowId: win.id },
        function(tabs)
        {
            var i,activetabid,multiplesaves;
            
            if (menuaction == 0)
            {
                selectedTabIds.length = 0;
                
                for (i = 0; i < tabs.length; i++) if (tabs[i].active) activetabid = tabs[i].id;
                    
                for (i = 0; i < tabs.length; i++)
                {
                    if (tabs[i].highlighted || tabs[i].active || applyAutomation)  /* Opera doesn't support highlighted - so check active */
                    {
                        if (!specialPage(tabs[i].url) || tabs[i].url == "about:blank")
                        {
                            selectedTabIds.push(tabs[i].id);
                            
                            chrome.tabs.update(tabs[i].id,{ active: true });  /* force load of background tab */
                        }
                    }
                }
                
                chrome.tabs.update(activetabid,{ active: true });  /* reinstate active tab */
                
                if (selectedTabIds.length == 0)
                {
                    alertNotify("No savable pages in selected tabs." + (applyAutomation ? " Automation ended." : ""));
                }
                else
                {
                    multiplesaves = (selectedTabIds.length > 1);
                    
                    cancelSave = false;
                    
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                }
            }
            else if (menuaction == 1)
            {
                listedURLs.length = 0;
                
                for (i = 0; i < urlListURLs.length; i++)
                {
                    if (!specialPage(urlListURLs[i])) listedURLs.push(urlListURLs[i]);
                }
                
                if (listedURLs.length == 0)
                {
                    alertNotify("No savable pages in Listed URLs." + (applyAutomation ? " Automation ended." : ""));
                }
                else
                {
                    multiplesaves = true;
                    
                    cancelSave = false;
                    
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                }
            }
            else
            {
                selectedTabIds.length = 0;
                
                for (i = 0; i < tabs.length; i++)
                {
                    if (tabs[i].active) selectedTabIds.push(tabs[i].id);
                }
                
                multiplesaves = false;
                
                cancelSave = false;
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
            }
            
            for (i = 0; i < tabs.length; i++)
            {
                if (tabs[i].highlighted && !tabs[i].active) chrome.tabs.update(tabs[i].id,{ highlighted: false });
            }
        });
    });
}

function nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves)
{
    var url,timeout;
    
    if (menuaction == 0)
    {
        if (cancelSave)
        {
            /* do nothing */
        }
        else if (selectedTabIds.length > 0)
        {
            currentTabId = selectedTabIds.shift();
            
            chrome.tabs.update(currentTabId,{ active: loadLazyContent },
            function(tab)
            {
                if (tab.url != "about:blank" && tab.status == "complete")
                {
                    performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                }
                else
                {
                    chrome.tabs.onUpdated.addListener(listener);
                    
                    function listener(tabId,changeInfo,tab)
                    {
                        if (tab.id == currentTabId && tab.url != "about:blank" && tab.status == "complete")
                        {
                            clearTimeout(timeout);
                            
                            chrome.tabs.onUpdated.removeListener(listener);
                            
                            performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                        }
                    }
                    
                    timeout = window.setTimeout(
                    function()
                    {
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                    },maxPageTime*1000);
                }
            });
        }
        else if (applyAutomation) 
        {
            window.setTimeout(  /* allow time to press Alt+C after saving all tabs */
            function()
            {
                if (!cancelSave)
                {
                    chrome.windows.getLastFocused({ },
                    function(win)
                    {
                        chrome.windows.remove(win.id);  /* close browser window used for automation */
                    });
                }
            },2000);
        }
    }
    else if (menuaction == 1)
    {
        if (cancelSave)
        {
            /* do nothing */
        }
        else if (listedURLs.length > 0)
        {
            url = listedURLs.shift();
            
            chrome.tabs.create({ windowId: saveWindowId, url: url, active: loadLazyContent },
            function(tab)
            {
                currentTabId = tab.id;
                
                chrome.tabs.onUpdated.addListener(listener);
                
                function listener(tabId,changeInfo,tab)
                {
                    if (tab.id == currentTabId && tab.status == "complete")
                    {
                        window.clearTimeout(timeout);
                        
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                    }
                }
                
                timeout = window.setTimeout(
                function()
                {
                    chrome.tabs.onUpdated.removeListener(listener);
                    
                    chrome.tabs.remove(currentTabId);  /* remove tab created for saving listed URL */
                    
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                },maxPageTime*1000);
            });
        }
        else if (applyAutomation) 
        {
            window.setTimeout(  /* allow time to press Alt+C after saving all tabs */
            function()
            {
                if (!cancelSave)
                {
                    chrome.windows.getLastFocused({ },
                    function(win)
                    {
                        chrome.windows.remove(win.id);  /* close browser window used for automation */
                    });
                }
            },2000);
        }
    }
    else
    {
        if (selectedTabIds.length > 0)
        {
            currentTabId = selectedTabIds.shift();
            
            performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
        }
    }
}

function performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves)
{
    chrome.tabs.get(currentTabId,
    async function(tab)
    {
        var i,allowed;
        var resources = new Array("message-panel","lazyload-panel","unsaved-panel","comments-panel","pageinfo-panel");
        
        if (chrome.runtime.lastError == null)  /* in case tab does not exist */
        {
            if (specialPage(tab.url))
            {
                alertNotify("Cannot be used with this page:\n > " + tab.title);
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
            }
            else if (tab.status != "complete")
            {
                alertNotify("Page is not ready:\n > " + tab.title);
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
            }
            else if (menuaction >= 2 && (typeof tabPageTypes[tab.id] == "undefined" || tabPageTypes[tab.id] == 0))  /* not saved page */
            {
                alertNotify("Page is not a saved page:\n > " + tab.title);
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
            }
            else  /* perform action */
            {
                allowed = await checkContentSecurityPolicy(tab.url);
                
                tabSaveParams[tab.id] = new Object();
                
                tabSaveParams[tab.id].menuaction = menuaction;
                tabSaveParams[tab.id].saveditems = saveditems;
                tabSaveParams[tab.id].togglelazy = togglelazy;
                tabSaveParams[tab.id].extractsrcurl = extractsrcurl;
                tabSaveParams[tab.id].externalsave = externalsave;
                tabSaveParams[tab.id].swapdevices = swapdevices;
                tabSaveParams[tab.id].multiplesaves = multiplesaves;
                tabSaveParams[tab.id].csprestriction = !allowed;
                
                if (typeof tabSaveStates[tab.id] == "undefined" || tabSaveStates[tab.id] <= -4 )  /* script not loading or loaded */
                {
                    tabSaveStates[tab.id] = -3;
                    
                    for (i = 0; i < resources.length; i++)
                    {
                        chrome.tabs.insertCSS(tab.id,{ file: "/" + resources[i] + ".css", cssOrigin: "author" });
                    }
                    
                    chrome.tabs.executeScript(tab.id,{ file: "content.js" });
                    
                    chrome.tabs.executeScript(tab.id,{ file: "content-frame.js", allFrames: true });
                }
                else if (tabSaveStates[tab.id] == -2 || (tabSaveStates[tab.id] >= 6 && tabSaveStates[tab.id] <= 8))  /* script loaded or saved/removed/extracted */
                {
                    tabSaveStates[tab.id] = -1;
                    
                    chrome.tabs.sendMessage(tab.id,{ type: "performAction",
                                                     menuaction: menuaction,
                                                     saveditems: saveditems,
                                                     togglelazy: togglelazy,
                                                     extractsrcurl: extractsrcurl,
                                                     externalsave: externalsave,
                                                     swapdevices: swapdevices,
                                                     multiplesaves: multiplesaves,
                                                     csprestriction: !allowed },checkError);
                }
                else if (tabSaveStates[tab.id] >= -1 && tabSaveStates[tab.id] <= 5)  /* operation in progress */
                {
                    alertNotify("Operation already in progress:\n > " + tab.title);
                    
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,multiplesaves);
                }
            }
        }
    });
}

function finishAction(tabId,success)
{
    if (tabSaveParams[tabId].externalsave)
    {
        if (!isFirefox || ffVersion >= 54)
        {
            chrome.runtime.sendMessage(printEditId,{ type: "externalSaveDone", tabid: tabId, success: success },checkError);
        }
    }
    
    if (tabSaveParams[tabId].menuaction == 1 || closeTabAfter)
    {
        /* Remove tab created for saving listed URL */
        
        chrome.tabs.remove(tabId);
    }
    
    nextAction(tabSaveParams[tabId].menuaction,tabSaveParams[tabId].saveditems,tabSaveParams[tabId].togglelazy,tabSaveParams[tabId].extractsrcurl,
               tabSaveParams[tabId].externalsave,tabSaveParams[tabId].swapdevices,tabSaveParams[tabId].multiplesaves);
}

function cancelAction()
{
    cancelSave = true;
    
    applyAutomation = false;  /* end automation */
    
    chrome.tabs.sendMessage(currentTabId,{ type: "cancelSave" },checkError);
}

/************************************************************************/

/* Check content security policy function */

async function checkContentSecurityPolicy(url)
{
    var response,securityPolicy,allowed,namepos,valuepos;
    
    if (url.substr(0,8) == "file:///") return true;  /* download allowed */
    
    try
    {
        response = await fetch(url,{ method: "HEAD", mode: "cors", cache: "no-cache" });
        
        if (response.status == 200)
        {
            securityPolicy = response.headers.get("Content-Security-Policy");
            if (securityPolicy == null) securityPolicy = "";
            
            securityPolicy = securityPolicy.toLowerCase();
            
            namepos = securityPolicy.search(/(^|;|\s)sandbox\s/i);
            valuepos = securityPolicy.search(/\sallow-downloads($|;|\s)/i);
            
            allowed = (namepos < 0 || valuepos >= 0);
            
            return allowed;  /* download may not be allowed by sandbox */
        }
        else return false;  /* download not allowed */
    }
    catch (e)
    {
        return false;  /* download not allowed */
    }
}

/************************************************************************/

/* Special page function */

function specialPage(url)
{
    return (url.substr(0,6) == "about:" || url.substr(0,7) == "chrome:" || url.substr(0,12) == "view-source:" ||
            url.substr(0,14) == "moz-extension:" || url.substr(0,26) == "https://addons.mozilla.org" || url.substr(0,27) == "https://support.mozilla.org" ||
            url.substr(0,17) == "chrome-extension:" || url.substr(0,34) == "https://chrome.google.com/webstore");
}

/************************************************************************/

/* Update browser action function */

function updateBrowserAction(tabId,url)
{
    /* Cannot catch errors in chrome.browserAction functions in cases where tabs have closed */
    /* Workaround is to delay and then make sure tab exists before calling these functions */
    
    window.setTimeout(
    function()
    {
        chrome.tabs.get(tabId,
        function(tab)
        {
            var pagetype,savestate;
            
            if (chrome.runtime.lastError == null && typeof tab != "undefined" && tab.url != "about:blank")  /* tab not closed or about:blank */
            {
                if ((buttonActionType == 0 && (highlightedCount > 1 || (!specialPage(url) && tab.status == "complete"))) || buttonActionType == 1)
                {
                    chrome.browserAction.enable(tabId);
                    
                    if (!isFirefox || ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});  /* Chrome or Firefox 54- - icon not changed */
                }
                else
                {
                    chrome.browserAction.disable(tabId);
                    
                    if (!isFirefox || ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16-disabled.png"});  /* Chrome or Firefox 54- - icon not changed */
                }
                
                pagetype = (typeof tabPageTypes[tabId] == "undefined") ? 0 : tabPageTypes[tabId];
                
                if (tab.status != "complete") chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - page is not ready" });
                else if (specialPage(url)) chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - cannot be used with this page" });
                else if (pagetype == 0) chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - normal page" });
                else if (pagetype == 1) chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - saved page" });
                else if (pagetype == 2) chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - saved page with resource loader" });
                
                savestate = (typeof tabSaveStates[tabId] == "undefined" || tabSaveStates[tabId] <= -1) ? 9 : tabSaveStates[tabId];
                
                chrome.browserAction.setBadgeText({ tabId: tabId, text: saveStateTexts[savestate] });
                if (isFirefox && ffVersion >= 63) chrome.browserAction.setBadgeTextColor({ tabId: tabId, color: "#FFFFFF" });
                chrome.browserAction.setBadgeBackgroundColor({ tabId: tabId, color: saveStateColors[savestate] });
            }
        });
    },10);
}

/************************************************************************/

/* Update context menus function */

function updateContextMenus()
{
    chrome.tabs.query({ lastFocusedWindow: true, active: true },
    function(tabs)
    {
        var pagetype,savestate,loaded,enable,title;
        var contexts = new Array();
        
        if (chrome.runtime.lastError == null && typeof tabs[0] != "undefined" && tabs[0].url != "about:blank")  /* tab not closed or about:blank */
        {
            contexts = showSubmenu ? [ "all" ] : [ "browser_action" ];
            pagetype = (typeof tabPageTypes[tabs[0].id] == "undefined") ? 0 : tabPageTypes[tabs[0].id];
            savestate = (typeof tabSaveStates[tabs[0].id] == "undefined") ? 9 : tabSaveStates[tabs[0].id];
            loaded = (tabs[0].status == "complete");
            enable = (highlightedCount > 1 || (!specialPage(tabs[0].url) && loaded));
            title = loadLazyContent ? "Without " : "With ";
            title += (lazyLoadType == "0") ? "Scroll:" : "Shrink:";
            
            chrome.contextMenus.update("saveselectedtabs",{ contexts: contexts, enabled: (pagetype <= 1 && enable) });
            
            chrome.contextMenus.update("saveselectedtabs-w-title",{ title: title });
            
            chrome.contextMenus.update("savelistedurls",{ contexts: contexts, enabled: (urlListURLs.length > 0) });
            
            chrome.contextMenus.update("savelistedurls-w-title",{ title: title });
            
            chrome.contextMenus.update("cancelsave",{ contexts: contexts, enabled: (savestate >= 0 && savestate <= 3) });
            
            chrome.contextMenus.update("viewpageinfo",{ contexts: contexts, enabled: (pagetype >= 1 && loaded) });
            
            chrome.contextMenus.update("removeresourceloader",{ contexts: (pagetype == 2) ? contexts : [ "page_action" ], enabled: (pagetype == 2 && loaded) });
            
            chrome.contextMenus.update("extractmedia",{ contexts: (pagetype >= 1) ? [ "image","audio","video" ] : [ "page_action" ], enabled: (pagetype >= 1 && loaded) });
        }
    });
}

/************************************************************************/

/* Check for sendMessage errors */

function checkError()
{
    if (chrome.runtime.lastError == null) ;
    else if (chrome.runtime.lastError.message == "Could not establish connection. Receiving end does not exist.") ;  /* Chrome & Firefox - ignore */
    else if (chrome.runtime.lastError.message == "The message port closed before a response was received.") ;  /* Chrome - ignore */
    else if (chrome.runtime.lastError.message == "Message manager disconnected") ;  /* Firefox - ignore */
    else console.log("Save Page WE - " + chrome.runtime.lastError.message);
}

/************************************************************************/

/* Display alert notification */

function alertNotify(message)
{
    chrome.notifications.create("alert",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE", message: "" + message });
}

/************************************************************************/

/* Display debug notification */

function debugNotify(message)
{
    chrome.notifications.create("debug",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE - DEBUG", message: "" + message });
}

/************************************************************************/
