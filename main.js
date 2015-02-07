/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const {unloadWindow} = require("sdk/windows");
Cu.import("resource:///modules/CustomizableUI.jsm");

CustomizableUI.createWidget({
  id: "samchanedit-button",
  label: "Samsung Channel Editor",
  tooltiptext: "Samsung Channel Editor",
  defaultArea: CustomizableUI.AREA_NAVBAR,
  onBeforeCreated: function(document) {
    log(LOG_DEBUG, "Creating a button");
    try {
      let window = document.defaultView;
      let winUtils = window.getInterface(Ci.nsIDOMWindowUtils);
      let uri = Services.io.newURI(BASE_PATH + "button.css", null, null);
      let flags = Ci.nsIDOMWindowUtils.AUTHOR_SHEET;
      winUtils.loadSheet(uri, flags);
      unloadWindow(window, () => winUtils.removeSheet(uri, flags));
    }
    catch (ex) {
      log(LOG_ERROR, "Failed to create button", ex);
    }
  },
  onClick: function(evt) {
    try {
      let document = (evt.target.ownerDocument || evt.target);
      let window = document.defaultView;
      window.gBrowser.selectedTab =
        window.gBrowser.addTab(BASE_PATH + "editor.xul");
    }
    catch (ex) {
      log(LOG_ERROR, "Failed to execute click", ex);
    }
  }
});
unload(() => CustomizableUI.destroyWidget("samchanedit-button"));

/* vim: set et ts=2 sw=2 : */
