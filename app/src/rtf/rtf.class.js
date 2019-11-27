const cheerio         = require('cheerio');
const Style           = require('../style/style.class');
const AllowedHtmlTags = require('../allowed-html-tags/allowed-html-tags.class');
const Table           = require('../table/table.class');
const MyString        = require('../string/my-string.class');
const juice 		      = require('juice');
const charset = require('./charset.module')
const fs 				      = require('fs');

class Rtf {
  constructor() { 
    this.rtfHeaderOpening = "{\\rtf1\\fbidis\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}";
    this.rtfHeaderContent = '';
    this.rtfClosing = "}";
    this.rtfContentReferences = [];
    this.Table = new Table();
  }

  convertHtmlToRtf(html) {
    charset.forEach(c =>
            html = html.replace(new RegExp(c.htmlEntity, 'g'), c.rtfEscapeChar)
        );

      html = html.replace(/[^\u0000-\u007F]/g, function (element) {
          // handle based on https://www.zopatista.com/python/2012/06/06/rtf-and-unicode/
          let char = element.charCodeAt(0)
          return `\\u${char}?`
      });

      let $ = cheerio.load(juice(html));
      let treeOfTags = $('html').children();

      Array.from(treeOfTags).forEach(tag => this.readAllChildsInTag(tag));

      return this.buildRtf();
  }

  swapHtmlStrangerTags(html, dafaultTag) {
    return html.replace(/<(\/?[a-z-]+)( *[^>]*)?>/gi, (match, tagName, options) => {
      let newTag = !tagName.includes('/') ? `<${ dafaultTag }${ options ? options : '' }>` : `</${ dafaultTag }>`;
      return AllowedHtmlTags.isKnowedTag(tagName) ? match : `${ newTag }`;
    });
  }

  buildRtf() {
    this.rtfHeaderContent += Style.getRtfColorTable();
    let content = (this.rtfHeaderOpening + this.rtfHeaderContent + this.getRtfContentReferences() + this.rtfClosing);
    this.clearCacheContent();
    return content;
  }

  getRtfContentReferences() {
    let rtfReference = '';
    this.rtfContentReferences.forEach(value => rtfReference += value.content);
    return rtfReference;
  }

  // Don't has a test
  readAllChildsInTag(fatherTag) {
    if (fatherTag.children != undefined) {
      this.addOpeningTagInRtfCode(fatherTag.name);
      this.ifExistsAttributesAddAllReferencesInRtfCode(fatherTag.attribs);

      if(fatherTag.name.toLowerCase() == 'table')
        this.Table.setAmountOfColumns(this.getAmountOfColumnThroughOfFirstChildOfTbodyTag(fatherTag.children));

      if(fatherTag.name.toLowerCase() == 'tr')
        this.addReferenceTagInRtfCode(this.Table.buildCellsLengthOfEachColumn());

      if(fatherTag.name.toLowerCase() == 'mark')
        this.setHighlightInRtf();

      (fatherTag.children).forEach((child, index) => {
        if (child.type != 'text')
          this.readAllChildsInTag(child);
        else
          this.addContentOfTagInRtfCode(child.data);
      });
    }
    this.addClosingFatherTagInRtfCode(fatherTag.name);
  }

  getAmountOfColumnThroughOfFirstChildOfTbodyTag(tableChildren) {
    let count = 0;
    let tbodyIndex = tableChildren.findIndex(value => value.name == 'tbody');
    for(let i = 0; i < tableChildren[tbodyIndex].children.length; i++) {
      if(tableChildren[tbodyIndex].children[i].type != 'text') {
        (tableChildren[tbodyIndex].children[i].children).forEach((child, index) => {
          if(child.type != 'text')
            count++;          
        });
        break;
      }
    }
    return count;
  }

  ifExistsAttributesAddAllReferencesInRtfCode(attributes) {
    if(attributes.style != undefined)
      this.addReferenceTagInRtfCode(Style.getRtfReferencesInStyleProperty(attributes.style));
    if(attributes.align != undefined)
      this.addReferenceTagInRtfCode(Style.getRtfAlignmentReference(attributes.align));
  }

  addReferenceTagInRtfCode(referenceTag) {
    if(referenceTag != undefined)
      this.rtfContentReferences.push({ content: referenceTag, tag: true });
  }

  addOpeningTagInRtfCode(tag) {
    this.addReferenceTagInRtfCode(AllowedHtmlTags.getRtfReferenceTag(tag));
  }

  addClosingFatherTagInRtfCode(closingFatherTag) {
    this.addReferenceTagInRtfCode(AllowedHtmlTags.getRtfReferenceTag(`/${ closingFatherTag }`));
  }

  addContentOfTagInRtfCode(contentOfTag) {
    contentOfTag = MyString.removeCharacterOfEscapeInAllString(contentOfTag, '\n\t');
   
    if(contentOfTag != undefined && !MyString.hasOnlyWhiteSpace(contentOfTag))
      this.rtfContentReferences.push({ content: this.addSpaceAroundString(contentOfTag.trim()), tag: false });
  }

  addSpaceAroundString(contentOfTag) {
    return ` ${ contentOfTag }`;
  }

  setHighlightInRtf() {
    let rtfReferenceColor = Style.getRtfReferenceColor('rgb(255, 255, 0)');
    let referenceColorNumber = rtfReferenceColor.match(/[0-9]+/);
    this.addReferenceTagInRtfCode('\\highlight' + referenceColorNumber.toString());
  }

  saveRtfInFile(path, value) {
    fs.writeFile(path, value, (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
  }

  clearCacheContent() {
    this.rtfHeaderContent = '';
    this.rtfContentReferences = [];    
  }

}
module.exports = Rtf;
