class UploadModel {
  constructor (doc) {
    _.extend(this, doc);
  }
  isImage () {
    return this.type.indexOf('image') !== -1;
  }
  isVideo () {
    return this.type.indexOf('video') !== -1 || this.name.indexOf('.webm') !== -1;
  }
  isFile () {
    return ! this.isImage() && ! this.isVideo();
  }
}
var Uploads = new Mongo.Collection("Uploads", {
  transform: (doc) => new UploadModel(doc),
});


function initClient () {
  Session.set("_isDrag", false);
  Session.set("_itemsLoaded", false);
  Session.set("_hasPermissionCache", false);

  Meteor.startup(function () {
    // Asynchronously check permission on startup
    Meteor.call('hasPermission', (error, result) => {
      _hasPermissionCache = result;
      Session.set("_hasPermissionCache", result);
    });
  });

  Template.dropzone_app.helpers({
    uploads: () => Uploads.find({}, {sort: {createdAt: -1}}),
    empty: () => Uploads.find().count() === 0,
    isDrag: () => Session.get("_isDrag"),
    writeEnabled: () => Session.get("_hasPermissionCache"),
    isLoaded: () => Session.get("_itemsLoaded"),
  });

  Template.upload_tmpl.helpers({
    writeEnabled: () => Session.get("_hasPermissionCache"),
  });

  Template.body.events({
    'drag': (e, t) => Session.set("_isDrag", true),
    'dragstart': (e, t) => Session.set("_isDrag", true),
    'dragend': (e, t) => Session.set("_isDrag", false),
    'dragover': (e, t) => Session.set("_isDrag", true),
    'dragenter': (e, t) => Session.set("_isDrag", true),
    'dragleave': (e, t) => Session.set("_isDrag", false),
    'drop': (e, t) => Session.set("_isDrag", false),
  });

  Template.upload_tmpl.events({
    'click .deleteButton': (e, t) => {
      if (window.confirm("Confirm remove?")) {
        var _id = e.target.getAttribute("docId");
        Meteor.call("deleteFile", _id);
      }
    },
  });

  /* Lazy loading */
  var reCheckLazyLoading = function () {
    setTimeout(() => $(window).trigger("lookup"), 500);
  }
  Template.upload_tmpl.rendered = function () {
    $('.lazy').unveil(100, function() {
      this.removeAttribute('width');
      this.removeAttribute('height');
      this.removeAttribute('data-src');
      this.removeAttribute('class');
      this.style.opacity = 1;
    });
    reCheckLazyLoading();
  };
  Uploads.find().observe({
    added: reCheckLazyLoading,
    removed: reCheckLazyLoading,
  })

  /* Subscribe */
  Meteor.subscribe("uploads", () => Session.set('_itemsLoaded', true));
}

function initServer () {
  /* Clean headers, because undefined values break the headers lib */
  WebApp.rawConnectHandlers.use(function (req, res, next) {
    for (var key in req.headers) {
      if (req.headers[key] === undefined) {
        delete req.headers[key];
      }
    }
    return next();
  });

  Meteor.startup(function () {
    /* Temporary thing for development. Fixup absolute URL */
    console.log('Checking fixups');
    var needCorrecting = Uploads.find({'url': {'$regex': 'http:\/\/'}})
    if (needCorrecting.count() > 0) {
      needCorrecting.forEach(function(doc) {
        console.log('Fixup:');
        console.log(doc);
        Uploads.update(doc._id, {
          $set: {
            url: '/upload/' + doc.name,
            baseUrl: '/upload/',
          }
        });
      });
    }
    /* end temporary fix */

    var uploadDir;
    console.log("PWD:");
    console.log(process.env.PWD);
    if (process.env.PWD == '/') {
      uploadDir = '/var/';
    } else {
      uploadDir = process.env.PWD + '/uploads/';
    }
    UploadServer.init({
      tmpDir: uploadDir + '/tmp',
      uploadDir: uploadDir,
      checkCreateDirectories: true,
      finished: function(fileInfo, formFields) {
        // UploadServer stores absolute URLS by default. Convert to relative
        var absoluteBaseUrl = fileInfo.baseUrl;
        _.extend(fileInfo, {
          createdAt: new Date(),
          text: "",
          owner: this.userId || null,
          baseUrl: '/upload/',
          url: '/upload/' + fileInfo.url.replace(absoluteBaseUrl, ""),
        });
        //console.log(this.userId);
        console.log(fileInfo);
        Uploads.insert(fileInfo);
      },
      cacheTime: 100,
    });
  });

  /* Publish */
  Meteor.publish("uploads", () => Uploads.find());

  /* Permissions */
  Uploads.allow({
    insert: (userId, doc) => Meteor.call('hasPermission'),
    update: (userId, doc) => Meteor.call('hasPermission'),
    remove: (userId, doc) => Meteor.call('hasPermission'),
  });
  Meteor.users.allow({
    insert: (userId, doc) => false,
    update: (userId, doc) => false,
    remove: (userId, doc) => false,
  });

  Meteor.methods({
    deleteFile: function (_id) {
      if ( ! _id instanceof String) {
        throw new Meteor.Error(404, 'Invalid id argument');
      }
      var upload = Uploads.findOne(_id);
      if (upload == null) {
        throw new Meteor.Error(404, 'Upload not found'); // maybe some other code
      }
      Uploads.remove(_id);
      if (Meteor.isServer) {
        UploadServer.delete(upload.path);
      }
    },

    /**
     * Note it's important to use an old-school function() {}, so `this` gets
     * bound correctly
     */
    hasPermission: function () {
      var h = headers.get(this);
      var p = h['x-sandstorm-permissions'] || "";
      // console.log(p);
      return p.indexOf('modify') !== -1 || p.indexOf('owner') !== -1;
    },
  });

}

if (Meteor.isClient) {
  initClient();
}

if (Meteor.isServer) {
  initServer();
}
