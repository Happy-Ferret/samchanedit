const {require, unload, Cc, Ci, Cu, Cr, ctor, Services, Instances, XPCOMUtils} =
  Components.utils.import("chrome://samchanedit/content/loader.jsm", {});
const {log, LOG_DEBUG, LOG_ERROR, LOG_INFO, LOG_WARN} = require("sdk/logging");

log(LOG_DEBUG, "present");

const $ = id => document.getElementById(id);
const BinaryInputStream = Instances.get("BinaryInputStream",
                                        "@mozilla.org/binaryinputstream;1",
                                        "nsIBinaryInputStream",
                                        "setInputStream");
const BinaryOutputStream = Instances.get("BinaryOutputStream",
                                         "@mozilla.org/binaryoutputstream;1",
                                         "nsIBinaryOutputStream",
                                         "setOutputStream");
const FilePicker = Instances.get("FilePicker",
                                 "@mozilla.org/filepicker;1", "nsIFilePicker",
                                 "init");
const LocalFile = Instances.get("LocalFile",
                                "@mozilla.org/file/local;1",
                                "nsIFile", "initWithPath");
const Pipe = Instances.get("Pipe",
                           "@mozilla.org/pipe;1", "nsIPipe", "init");
const ZipReader = Instances.get("ZipReader",
                                "@mozilla.org/libjar/zip-reader;1",
                                "nsIZipReader", "open");
const ZipWriter = Instances.get("ZipWriter",
                                "@mozilla.org/zipwriter;1",
                                "nsIZipWriter", "open");

const ChannelTypes =
  new Map([[0x01, "TV"], [0x02, "Radio"], [0x0c, "Data"], [0x19, "HDTV"]]);
const UnicodeDecoder = new TextDecoder("utf-16be");

const Tree = {
  elem: $("channels"),
  channels: [],
  renumberChannels: function() {
    // Renumber channels
    let no = 1;
    let noR = 1000;
    this.channels.forEach((e, idx) => {
      if (e.type == "Radio") {
        e.no = noR++;
      }
      else {
        e.no = no++;
      }
    });
  },
  sortChannels: function() {
    this.channels.sort((a,b) => a.no - b.no);
  },
  remove: function() {
    if (!this.selection.currentIndex) {
      return;
    }
    let ci = {};
    this.selection.getRangeAt(0, ci, {});
    ci = ci.value || 0;
    let removed = [];
    this.box.beginUpdateBatch();
    try {
      this.channels = this.channels.filter( (e, idx) => {
        let rv = !this.selection.isSelected(idx);
        if (!rv) {
           removed.push(idx - removed.length);
        }
        return rv;
      });
      for (let i of removed) {
        this.box.rowCountChanged(i, -1);
      }

      if (this.channels.length) {
        ci = Math.min(ci, this.channels.length - 1);
        this.selection.rangedSelect(ci, ci, false);
      }
      else {
        this.selection.clearSelection();
      }
    }
    finally {
      this.box.endUpdateBatch();
      if (removed.length) {
        this.renumberChannels();
        this.box.invalidate();
      }
    }
  },
  get rowCount() {
    $("channelNumber").value = `${this.channels.length} channels`;
    return this.channels.length;
  },
  getRowProperties: function(index) {
    return "";
  },
  getCellProperties: function(row, col) {
    if (col.index == 0) {
      return `iconic ${this.channels[row].type}`;
    }
    if (col.index == 1) {
      return "bold";
    }
    return "";
  },
  getColumnProperties: function(col) {
    return "";
  },
  isContainer() {
    return false;
  },
  isContainerOpen: false,
  isContainerEmpty: false,
  isSeparator: function(row) {
    return false;
  },
  isSorted: function() {
    return false;
  },
  canDrop: function(index, orient, transfer) {
    let rv = transfer.types.contains("appliction/x-samchanedit-move");
    if (rv) {
      transfer.dropEffect = "move";
    }
    log(LOG_DEBUG, `canDrop ${rv}`);
    return rv;
  },
  dragStart: function(event) {
    let transfer = event.dataTransfer;
    transfer.effectAllowed = "copymove";
    transfer.setData("appliction/x-samchanedit-move", 0);
  },
  drop: function(row, orient, transfer) {
    if (!this.canDrop(row, orient, transfer)) {
      return;
    }
    this.box.beginUpdateBatch();
    try {
      if (orient == 1) {
        ++row;
      }
      let selectedIds = this.channels.map(
        (e, idx) => (this.selection.isSelected(idx) && [e, idx]) || null).filter(
        e => e != null);
      let channels = selectedIds.reverse().map(e => {
        let id = e[1];
        e = e[0];
        if (id < row) {
          --row;
        }
        this.channels.splice(id, 1);
        return e;
      });
      for (let e of channels) {
        this.channels.splice(row, 0, e);
      }
      this.selection.rangedSelect(row, row + channels.length - 1, false);
    }
    finally {
      this.box.endUpdateBatch();
      this.box.ensureRowIsVisible(Math.max(row, 0));
      this.renumberChannels();
      this.sortChannels();
      this.box.invalidate();
    }
  },
  getParentIndex: function(row) {
    return -1;
  },
  hasNextSibling: function(row, after) {
    return false;
  },
  getLevel: function(row) {
    return 0;
  },
  getImageSrc: function(row, col) {
    return "";
  },
  getProcessMode: function(row, col) {
    return 3;
  },
  getCellValue: function(row, col) {
    let ch = this.channels[row];
    switch (col.index) {
      case 3:
        return ch.encrypted.toString();
    }
  },
  getCellText: function(row, col) {
    let ch = this.channels[row];
    switch (col.index) {
      case 0:
        return ch.no;
      case 1:
        return ch.name;
      case 2:
        return ch.type;
      case 3:
        return ch.encrypted;
      case 4:
        return ch.sid;
      default:
        return "";
    }
  },
  setTree: function(box) {
    log(LOG_DEBUG, `setTree ${box}`);
    this.box = box;
    if (!box) {
      return;
    }
    this.renumberChannels();
    this.sortChannels();
  },
  toggleOpenState: function(index) {
  },
  selectionChanged: function() {
  },
  cycleCell: function(row, col) {
  },
  isEditable: function(row, col) {
    console.log(row, col);
    return col.index == 1;
  },
  isSelectable: function(row, col) {
    return col.index == 1;
  },
  setCellValue: function(row, col, value) {
    log(LOG_DEBUG, `value ${row} ${col.index} ${value}`);
  },
  setCellText: function(row, col, text) {
    log(LOG_DEBUG, `text ${row} ${col.index} ${text}`);
    if (col.index != 1) {
      return;
    }
    let ch = this.channels[row];
    try {
      ch.name = text;
      this.box.invalidateRow(row);
    }
    catch (ex) {
      alert(ex);
    }
  },
  performAction: function(action) {
    log(LOG_DEBUG, `action ${action}`);
  },
  performActionOnRow: function(action, row) {
    log(LOG_DEBUG, `actionOnRow ${action} ${row}`);
  },
  performActionOnCell: function(action, row, col) {
    log(LOG_DEBUG, `actionOnCell ${action} ${row} ${col.index}`);
  }
};


function Channel(data) {
  this.data = data;
  this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  this._checksum(); // Always do an intial checksum run
}
Channel.prototype = {
  get no() {
    return this.view.getUint16(0, true);
  },
  set no(val) {
    if (val == this.no) {
      return;
    }
    log(LOG_DEBUG, `setting ${this} to ${val}`);
    this.view.setUint16(0, val, true);
    this._checksum();
  },
  get name() {
    if (!this._name) {
      let str = [];
      for (let i = 64; i < 164; i += 2) {
        str.push(String.fromCharCode(this.view.getUint16(i)));
      }
      this._name = str.join("");
      let idx = this._name.indexOf("\0");
      if (idx >= 0) {
        this._name = this._name.substr(0, idx);
      }
      this._name = this._name.trim();
    }
    return this._name;
  },
  set name(nv) {
    if (nv == this._name) {
      return;
    }
    delete this._name;
    let str = nv.split("").map(e => e.charCodeAt(0));
    if (str.length > 50) {
      throw Error("Name too long!");
    }
    for (let i = 64; i < 164; i += 2) {
      this.view.setUint16(i, str[(i - 64) / 2] || 0);
    }
    this._checksum();
  },
  get encrypted() {
    return !!this.data[24];
  },
  get type() {
    return ChannelTypes.get(this.data[15]) || "Unknown";
  },
  get sid() {
    let sid = this.view.getUint16(6, true).toString(16).toUpperCase();
    sid = "0000".substr(0, 4 - sid.length) + sid;
    return sid;
  },
  _checksum: function() {
    let sum = Array.reduce(this.data.subarray(0, this.data.byteLength - 1),
                           (p, c) => (p + c) & 0xff, 0);
    this.data[this.data.byteLength - 1] = sum;
  },
  toString: function() {
    return `${this.name} (${this.type})`;
  }
};

function loadFile() {
  let picker = new FilePicker(window, "Open Samsung Channel File",
                              Ci.nsIFilePicker.modeOpen);
  picker.defaultExtension = "scm";
  picker.appendFilter("Samsung Channel File", "*.scm");
  picker.open(result => {
    if (result != 0) {
      return;
    }
    try {
      Tree.file = picker.file.clone();
      const reader = new ZipReader(Tree.file);
      try {
        const entry = reader.getEntry("map-CableD");
        if (!entry) {
          throw new Error("Failed to load file");
        }
        const buffer = new ArrayBuffer(entry.realSize);
        let stream = reader.getInputStream("map-CableD");
        new BinaryInputStream(stream).readArrayBuffer(
          entry.realSize, buffer);
        let channels = [];
        // We got 1000 channels per map file (for some reason only Samsung knows)
        let recordSize = entry.realSize / 1000;
        if (recordSize != Math.floor(recordSize)) {
          throw new Error("Unsupported record size!");
        }
        for (let i = 0; i < buffer.byteLength; i += recordSize) {
          let record = new Uint8Array(buffer, i, recordSize);
          if (!record[0] && !record[1]) {
            // Deleted record
            continue;
          }
          let ch = new Channel(record);
          channels.push(ch);
        }
        log(LOG_DEBUG, `Loaded ${Tree.file.path} ${entry.realSize} ${entry.realSize / 1000} ${channels.length}`);
        Tree.channels = channels;
        Tree.sortChannels();
        Tree.elem.view = Tree;
        $("save").removeAttribute("disabled");
      }
      finally {
        reader.close();
      }
    }
    catch (ex) {
      alert(ex.message);
    }
  });
}

function saveFile() {
  try {
    let bak = new LocalFile(Tree.file.path + ".bak");
    if (bak.exists()) {
      bak.remove(false);
    }
    Tree.file.copyTo(bak.parent, bak.leafName);
    let reader = ZipReader(bak);
    try {
      try {
        let writer = ZipWriter(Tree.file, 0x02 | 0x20);
        try {
          let entries = reader.findEntries("*");
          while (entries.hasMore()) {
            let entry = entries.getNext();
            let entryData = reader.getEntry(entry);
            if (entry == "map-CableD") {
              let buf = new Uint8Array(1000 * Tree.channels[0].data.byteLength);
              Tree.channels.forEach((e, idx) => {
                buf.set(e.data, idx * e.data.byteLength);
              });
              let pipe = new Pipe(true, true, buf.byteLength, 1);
              let os = pipe.outputStream;
              new BinaryOutputStream(os).
                writeByteArray(buf, buf.byteLength);
              os.close();
              writer.addEntryStream(entry, entryData.lastModifiedTime,
                                   Ci.nsIZipWriter.COMPRESSION_NONE,
                                   pipe.inputStream, false);
            }
            else {
              writer.addEntryStream(entry, entryData.lastModifiedTime,
                                    Ci.nsIZipWriter.COMPRESSION_NONE,
                                    reader.getInputStream(entry), false);
            }
          }
        }
        finally {
          writer.close();
        }
      }
      catch (ex) {
        if (Tree.file.exists()) {
          Tree.file.remove(false);
        }
        bak.copyTo(Tree.file.parent, Tree.file.leafName);
        throw ex;
      }
    }
    finally {
      reader.close();
    }
  }
  catch (ex) {
    log(LOG_ERROR, "Failed to save file", ex);
    alert(ex);
  }
}

function removeEncrypted() {
  Tree.channels = Tree.channels.filter(e => !e.encrypted);
  Tree.elem.view = Tree;
}

addEventListener("load", () => {
  $("load").addEventListener("click", loadFile);
  $("save").addEventListener("click", saveFile);
  $("removeEncrypted").addEventListener("click", removeEncrypted);
  Tree.elem.addEventListener("dragstart", e => Tree.dragStart(e));
  loadFile();
}, false);

