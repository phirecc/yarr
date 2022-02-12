'use strict';

var TITLE = document.title

var debounce = function(callback, wait) {
  var timeout
  return function() {
    var ctx = this, args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(function() {
      callback.apply(ctx, args)
    }, wait)
  }
}

Vue.directive('scroll', {
  inserted: function(el, binding) {
    el.addEventListener('scroll', debounce(function(event) {
      binding.value(event, el)
    }, 200))
  },
})

Vue.component('drag', {
  props: ['width'],
  template: '<div class="drag"></div>',
  mounted: function() {
    var self = this
    var startX = undefined
    var initW = undefined
    var onMouseMove = function(e) {
      var offset = e.clientX - startX
      var newWidth = initW + offset
      self.$emit('resize', newWidth)
    }
    var onMouseUp = function(e) {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    this.$el.addEventListener('mousedown', function(e) {
      startX = e.clientX
      initW = self.width
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  },
})

Vue.component('dropdown', {
  props: ['class', 'toggle-class', 'ref', 'drop', 'title'],
  data: function() {
    return {open: false}
  },
  template: `
    <div class="dropdown" :class="$attrs.class">
      <button ref="btn" @click="toggle" :class="btnToggleClass" :title="$props.title"><slot name="button"></slot></button>
      <div ref="menu" class="dropdown-menu" :class="{show: open}"><slot v-if="open"></slot></div>
    </div>
  `,
  computed: {
    btnToggleClass: function() {
      var c = this.$props.toggleClass || ''
      c += ' dropdown-toggle dropdown-toggle-no-caret'
      c += this.open ? ' show' : ''
      return c.trim()
    }
  },
  methods: {
    toggle: function(e) {
      this.open ? this.hide() : this.show()
    },
    show: function(e) {
      this.open = true
      this.$refs.menu.style.top = this.$refs.btn.offsetHeight + 'px'
      var drop = this.$props.drop

      if (drop === 'right') {
        this.$refs.menu.style.left = 'auto'
        this.$refs.menu.style.right = '0'
      } else if (drop === 'center') {
        this.$nextTick(function() {
          var btnWidth = this.$refs.btn.getBoundingClientRect().width
          var menuWidth = this.$refs.menu.getBoundingClientRect().width
          this.$refs.menu.style.left = '-' + ((menuWidth - btnWidth) / 2) + 'px'
        }.bind(this))
      }

      document.addEventListener('click', this.clickHandler)
    },
    hide: function() {
      this.open = false
      document.removeEventListener('click', this.clickHandler)
    },
    clickHandler: function(e) {
      var dropdown = e.target.closest('.dropdown')
      if (dropdown == null || dropdown != this.$el) return this.hide()
      if (e.target.closest('.dropdown-item') != null) return this.hide()
    }
  },
})

Vue.component('modal', {
  props: ['open'],
  template: `
    <div class="modal custom-modal" tabindex="-1" v-if="$props.open">
      <div class="modal-dialog">
        <div class="modal-content" ref="content">
          <div class="modal-body">
            <slot v-if="$props.open"></slot>
          </div>
        </div>
      </div>
    </div>
  `,
  data: function() {
    return {opening: false}
  },
  watch: {
    'open': function(newVal) {
      if (newVal) {
        this.opening = true
        document.addEventListener('click', this.handleClick)
      } else {
        document.removeEventListener('click', this.handleClick)
      }
    },
  },
  methods: {
    handleClick: function(e) {
      if (this.opening) {
        this.opening = false
        return
      }
      if (e.target.closest('.modal-content') == null) this.$emit('hide')
    },
  },
})

function dateRepr(d) {
  var sec = (new Date().getTime() - d.getTime()) / 1000
  var neg = sec < 0
  var out = ''

  sec = Math.abs(sec)
  if (sec < 2700)  // less than 45 minutes
    out = Math.round(sec / 60) + 'm'
  else if (sec < 86400)  // less than 24 hours
    out = Math.round(sec / 3600) + 'h'
  else if (sec < 604800)  // less than a week
    out = Math.round(sec / 86400) + 'd'
  else if (sec < 2419200) // less than a month
    out = Math.round(sec / 604800) + 'w'
  else
    out = d.toLocaleDateString(undefined, {year: "numeric", month: "long", day: "numeric"})

  if (neg) return '-' + out
  return out
}

Vue.component('relative-time', {
  props: ['val'],
  data: function() {
    var d = new Date(this.val)
    return {
      'date': d,
      'formatted': dateRepr(d),
      'interval': null,
    }
  },
  template: '<time :datetime="val">{{ formatted }}</time>',
  mounted: function() {
    this.interval = setInterval(function() {
      this.formatted = dateRepr(this.date)
    }.bind(this), 600000)  // every 10 minutes
  },
  destroyed: function() {
    clearInterval(this.interval)
  },
})

var vm = new Vue({
  created: function() {
    this.refreshStats()
      .then(this.refreshTags.bind(this))
      .then(this.refreshFeeds.bind(this))
      .then(this.refreshItems.bind(this, false))

    api.feeds.list_errors().then(function(errors) {
      vm.feed_errors = errors
    })
    if (/Mobi/.test(navigator.userAgent)) {
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const setColorScheme = e => {
        if (e.matches) {
          this.theme.name = "night"
        } else {
          this.theme.name = "light"
        }
        setColorScheme(darkModeMediaQuery)
        darkModeMediaQuery.addListener(setColorScheme)
      }
    }
  },
  data: function() {
    var s = app.settings
    return {
      'filterSelected': localStorage.filterSelected || "",
      'folders': [],
      'feeds': [],
      'fuzzyFeeds': [],
      'fuzzyEnabled': false,
      'fuzzySearchQuery': '',
      'fuzzyItemSelected': -1,
      'feedSelected': localStorage.feedSelected || "",
      'tagSelected': localStorage.tagSelected || -1,
      'tagColors': {},
      'feedListWidth': parseInt(localStorage.feedListWidth) || 300,
      'feedNewChoice': [],
      'feedNewChoiceSelected': '',
      'feedTags': {},
      'tagNames': {},
      'items': [],
      'itemsHasMore': true,
      'itemSelected': null,
      'itemSelectedDetails': null,
      'itemSelectedReadability': '',
      'itemSearch': '',
      'itemSortNewestFirst': localStorage.itemSortNewestFirst || true,
      'itemListWidth': parseInt(localStorage.itemListWidth) || 300,

      'filteredFeedStats': {},
      'filteredFolderStats': {},
      'filteredTotalStats': null,

      'settings': '',
      'loading': {
        'feeds': 0,
        'newfeed': false,
        'items': false,
        'readability': false,
      },
      'fonts': ['', 'serif', 'monospace'],
      'feedStats': {},
      'theme': {
        'name': localStorage.themeName || "light",
        'font': localStorage.themeFont || "",
        'size': localStorage.themeSize || 1,
      },
      'refreshRate': s.refresh_rate,
      'authenticated': app.authenticated,
      'feed_errors': {},
    }
  },
  computed: {
    foldersWithFeeds: function() {
      var feedsByFolders = this.feeds.reduce(function(folders, feed) {
        if (!folders[feed.folder_id])
          folders[feed.folder_id] = [feed]
        else
          folders[feed.folder_id].push(feed)
        return folders
      }, {})
      var folders = this.folders.slice().map(function(folder) {
        folder.feeds = feedsByFolders[folder.id]
        return folder
      })
      folders.push({id: null, feeds: feedsByFolders[null]})
      return folders
    },
    feedsById: function() {
      return this.feeds.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    foldersById: function() {
      return this.folders.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    current: function() {
      var parts = (this.feedSelected || '').split(':', 2)
      var type = parts[0]
      var guid = parts[1]

      var folder = {}, feed = {}

      if (type == 'feed')
        feed = this.feedsById[guid] || {}
      if (type == 'folder')
        folder = this.foldersById[guid] || {}

      return {type: type, feed: feed, folder: folder}
    },
    itemSelectedContent: function() {
      if (!this.itemSelected) return ''

      if (this.itemSelectedReadability)
        return this.itemSelectedReadability

      return this.itemSelectedDetails.content || ''
    },
  },
  watch: {
    'tagSelected': function(newVal) {
      this.refreshItems(false)
      this.computeStats()
    },
    'tagNames': function(newVal) {
      Object.keys(newVal).forEach(x => {
        if (!vm.tagColors[x]) {
          vm.tagColors[x] = "hsl(" + Math.floor(Math.random()*360) + ", 90%, 33%)"
        }
      })
    },
    'theme': {
      deep: true,
      handler: function(theme) {
        document.body.classList.value = 'theme-' + theme.name
        localStorage.themeName = theme.name
        localStorage.themeFont = theme.font
        localStorage.themeSize = theme.size
      },
    },
    'feedStats': {
      deep: true,
      handler: debounce(function() {
        var title = TITLE
        var unreadCount = Object.values(this.feedStats).reduce(function(acc, stat) {
          return acc + stat.unread + stat.starred
        }, 0)
        if (unreadCount) {
          title += ' ('+unreadCount+')'
        }
        document.title = title
        this.computeStats()
      }, 500),
    },
    'filterSelected': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      localStorage.filterSelected = newVal
      this.refreshItems(false)
      this.computeStats()
    },
    'feedSelected': function(newVal, oldVal) {
      this.fuzzyEnabled = false
      if (oldVal === undefined) return  // do nothing, initial setup
      localStorage.feedSelected = newVal
      this.refreshItems(false)
      if (this.$refs.itemlist) this.$refs.itemlist.scrollTop = 0
    },
    'itemSelected': function(newVal, oldVal) {
      this.itemSelectedReadability = ''
      if (newVal === null) {
        this.itemSelectedDetails = null
        return
      }
      if (this.$refs.content) this.$refs.content.scrollTop = 0

      api.items.get(newVal).then(function(item) {
        this.itemSelectedDetails = item
        if (vm.feedsById[vm.itemSelectedDetails.feed_id].readability) {
          vm.toggleReadability()
        }
      }.bind(this))
    },
    'itemSearch': debounce(function(newVal) {
      this.refreshItems()
    }, 500),
    'fuzzySearchQuery': function(newVal, oldVal) {
      vm.fuzzyItemSelected = -1
      vm.fuzzyFeeds = []
      // let r = new RegExp(newVal, "i")
      this.feeds.forEach(feed => {
        // if (feed.title.match(r)) {
        if (feed.title.toUpperCase().includes(newVal.toUpperCase())) {
          this.fuzzyFeeds.push(feed)
        }
      })
    },
    'itemSortNewestFirst': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      localStorage.itemSortNewestFirst = newVal
    },
    'feedListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      localStorage.feedListWidth = newVal
    }, 1000),
    'itemListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      localStorage.itemListWidth = newVal
    }, 1000),
    'refreshRate': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({refresh_rate: newVal})
    },
  },
  methods: {
    updateParentTag: function(tagId, parentId) {
      api.tags.updateParent(tagId, parentId).then(function() {
        vm.tagParents[tagId] = parentId
      })
    },
    matchesTags: function(feed) {
      if (this.tagSelected == -1) {
        return true
      }
      else if (this.feedTags[feed.id] != undefined) {
        if (this.feedTags[feed.id].includes(this.tagSelected)) {
          return true
        }
        else {
          for (const tag of this.feedTags[feed.id]) {
            if (this.tagParents[tag] == this.tagSelected) return true
          }
        }
      }
      return false
    },
    refreshStats: function(loopMode) {
      return api.status().then(function(data) {
        if (loopMode && !vm.itemSelected) vm.refreshItems()

        vm.loading.feeds = data.running
        if (data.running) {
          setTimeout(vm.refreshStats.bind(vm, true), 500)
        }
        vm.feedStats = data.stats.reduce(function(acc, stat) {
          acc[stat.feed_id] = stat
          return acc
        }, {})

        api.feeds.list_errors().then(function(errors) {
          vm.feed_errors = errors
        })
      })
    },
    getItemsQuery: function() {
      var query = {}
      if (this.feedSelected) {
        var parts = this.feedSelected.split(':', 2)
        var type = parts[0]
        var guid = parts[1]
        if (type == 'feed') {
          query.feed_id = guid
        } else if (type == 'folder') {
          query.folder_id = guid
        }
      }
      if (this.filterSelected) {
        query.status = this.filterSelected
      }
      if (this.itemSearch) {
        query.search = this.itemSearch
      }
      if (!this.itemSortNewestFirst) {
        query.oldest_first = true
      }
      if (this.tagSelected != -1) {
        query.tag = this.tagSelected
      }
      return query
    },
    refreshTags: function() {
      return Promise
        .all([api.tags.list()])
        .then(function(values) {
          vm.feedTags = values[0]["feed_tags"]
          vm.tagNames = values[0]["names"]
          vm.tagParents = values[0]["parents"]
        })
    },
    refreshFeeds: function() {
      return Promise
        .all([api.folders.list(), api.feeds.list()])
        .then(function(values) {
          vm.folders = values[0]
          vm.feeds = values[1]
        })
    },
    refreshItems: function(loadMore) {
      if (this.feedSelected === null) {
        vm.items = []
        return
      }

      var query = this.getItemsQuery()
      if (loadMore) {
        query.after = vm.items[vm.items.length-1].id
      }

      this.loading.items = true
      return api.items.list(query).then(function(data) {
        if (loadMore) {
          vm.items = vm.items.concat(data.list)
        } else {
          vm.items = data.list
        }
        vm.itemsHasMore = data.has_more
        vm.loading.items = false
      })
    },
    loadMoreItems: function(event, el) {
      if (!this.itemsHasMore) return

      if (this.loading.items) return
      var closeToBottom = (el.scrollHeight - el.scrollTop - el.offsetHeight) < 50
      if (closeToBottom) this.refreshItems(true)
    },
    markItemsRead: function() {
      var query = this.getItemsQuery()
      api.items.mark_read(query).then(function() {
        vm.items = []
        vm.itemsPage = {'cur': 1, 'num': 1}
        vm.itemSelected = null
        vm.itemsHasMore = false
        vm.refreshStats()
      })
    },
    toggleFolderExpanded: function(folder) {
      folder.is_expanded = !folder.is_expanded
      api.folders.update(folder.id, {is_expanded: folder.is_expanded})
    },
    formatDate: function(datestr) {
      var options = {
        year: "numeric", month: "long", day: "numeric",
        hour: '2-digit', minute: '2-digit', hour12: false,
      }
      return new Date(datestr).toLocaleDateString(undefined, options)
    },
    moveFeed: function(feed, folder) {
      var folder_id = folder ? folder.id : null
      api.feeds.update(feed.id, {folder_id: folder_id}).then(function() {
        feed.folder_id = folder_id
        vm.refreshStats()
      })
    },
    moveFeedToNewFolder: function(feed) {
      var title = prompt('Enter folder name:')
      if (!title) return
      api.folders.create({'title': title}).then(function(folder) {
        api.feeds.update(feed.id, {folder_id: folder.id}).then(function() {
          vm.refreshFeeds().then(function() {
            vm.refreshStats()
          })
        })
      })
    },
    createNewFeedFolder: function() {
      var title = prompt('Enter folder name:')
      if (!title) return
      api.folders.create({'title': title}).then(function(result) {
        vm.refreshFeeds().then(function() {
          vm.$nextTick(function() {
            if (vm.$refs.newFeedFolder) {
              vm.$refs.newFeedFolder.value = result.id
            }
          })
        })
      })
    },
    renameFolder: function(folder) {
      var newTitle = prompt('Enter new title', folder.title)
      if (newTitle) {
        api.folders.update(folder.id, {title: newTitle}).then(function() {
          folder.title = newTitle
          this.folders.sort(function(a, b) {
            return a.title.localeCompare(b.title)
          })
        }.bind(this))
      }
    },
    deleteFolder: function(folder) {
      if (confirm('Are you sure you want to delete ' + folder.title + '?')) {
        api.folders.delete(folder.id).then(function() {
          if (vm.feedSelected === 'folder:'+folder.id) {
            vm.items = []
            vm.feedSelected = ''
          }
          vm.refreshStats()
          vm.refreshFeeds()
        })
      }
    },
    renameFeed: function(feed) {
      var newTitle = prompt('Enter new title', feed.title)
      if (newTitle) {
        api.feeds.update(feed.id, {title: newTitle}).then(function() {
          feed.title = newTitle
        })
      }
    },
    setFilterRule: function(feed) {
      let newFilterRule = prompt('Enter fitler rule', feed.filter_rule)
      if (newFilterRule) {
        api.feeds.update(feed.id, {filterRule: newFilterRule}).then(function() {
          feed.filter_rule = newFilterRule
        })
      }
    },
    setTag: function(feed) {
      if (Object.keys(feed).length == 0) return
      let oldTags = ""
      if (vm.feedTags[feed.id]) {
        vm.feedTags[feed.id].forEach(x => oldTags += vm.tagNames[x] + ',')
        oldTags = oldTags.slice(0, -1)
      }
      let newTags = prompt('Enter tag', oldTags)
      if (newTags) {
        api.tags.update(feed.id, newTags).then(function() {
          vm.refreshTags()
        })
      }
    },
    toggleFeedReadability: function(feed) {
      api.feeds.update(feed.id, {readability: !feed.readability}).then(function() {
        feed.readability = !feed.readability
      })
    },
    deleteFeed: function(feed) {
      if (confirm('Are you sure you want to delete ' + feed.title + '?')) {
        api.feeds.delete(feed.id).then(function() {
          // unselect feed to prevent reading properties of null in template
          var isSelected = !vm.feedSelected
            || (vm.feedSelected === 'feed:'+feed.id
            || (feed.folder_id && vm.feedSelected === 'folder:'+feed.folder_id));
          if (isSelected) vm.feedSelected = null

          vm.refreshStats()
          vm.refreshFeeds()
        })
      }
    },
    createFeed: function(event) {
      var form = event.target
      var data = {
        url: form.querySelector('input[name=url]').value,
        folder_id: parseInt(form.querySelector('select[name=folder_id]').value) || null,
      }
      if (this.feedNewChoiceSelected) {
        data.url = this.feedNewChoiceSelected
      }
      this.loading.newfeed = true
      api.feeds.create(data).then(function(result) {
        if (result.status === 'success') {
          vm.refreshFeeds()
          vm.refreshStats()
          vm.settings = ''
          vm.feedSelected = 'feed:' + result.feed.id
        } else if (result.status === 'multiple') {
          vm.feedNewChoice = result.choice
          vm.feedNewChoiceSelected = result.choice[0].url
        } else {
          alert('No feeds found at the given url.')
        }
        vm.loading.newfeed = false
      })
    },
    toggleItemStatus: function(item, targetstatus, fallbackstatus) {
      var oldstatus = item.status
      var newstatus = item.status !== targetstatus ? targetstatus : fallbackstatus

      var updateStats = function(status, incr) {
        if ((status == 'unread') || (status == 'starred')) {
          this.feedStats[item.feed_id][status] += incr
        }
      }.bind(this)

      api.items.update(item.id, {status: newstatus}).then(function() {
        updateStats(oldstatus, -1)
        updateStats(newstatus, +1)

        var itemInList = this.items.find(function(i) { return i.id == item.id })
        if (itemInList) itemInList.status = newstatus
        item.status = newstatus
      }.bind(this))
    },
    toggleItemStarred: function(item) {
      this.toggleItemStatus(item, 'starred', 'read')
    },
    toggleItemRead: function(item) {
      this.toggleItemStatus(item, 'unread', 'read')
    },
    importOPML: function(event) {
      var input = event.target
      var form = document.querySelector('#opml-import-form')
      this.$refs.menuDropdown.hide()
      api.upload_opml(form).then(function() {
        input.value = ''
        vm.refreshFeeds()
        vm.refreshStats()
      })
    },
    logout: function() {
      api.logout().then(function() {
        document.location.reload()
      })
    },
    toggleReadability: function() {
      if (this.itemSelectedReadability) {
        this.itemSelectedReadability = null
        return
      }
      var item = this.itemSelectedDetails
      if (!item) return
      if (item.link) {
        this.loading.readability = true
        api.crawl(item.link).then(function(data) {
          vm.itemSelectedReadability = data && data.content
          vm.loading.readability = false
        })
      }
    },
    showSettings: function(settings) {
      this.settings = settings

      if (settings === 'create') {
        vm.feedNewChoice = []
        vm.feedNewChoiceSelected = ''
      }
    },
    resizeFeedList: function(width) {
      this.feedListWidth = Math.min(Math.max(200, width), 700)
    },
    resizeItemList: function(width) {
      this.itemListWidth = Math.min(Math.max(200, width), 700)
    },
    resetFeedChoice: function() {
      this.feedNewChoice = []
      this.feedNewChoiceSelected = ''
    },
    incrFont: function(x) {
      this.theme.size = +(this.theme.size + (0.1 * x)).toFixed(1)
    },
    fetchAllFeeds: function() {
      if (this.loading.feeds) return
      api.feeds.refresh().then(function() {
        vm.refreshStats()
      })
    },
    computeStats: function() {
      var filter = this.filterSelected
      if (!filter) {
        this.filteredFeedStats = {}
        this.filteredFolderStats = {}
        this.filteredTotalStats = null
        return
      }

      var statsFeeds = {}, statsFolders = {}, statsTotal = 0

      for (var i = 0; i < this.feeds.length; i++) {
        var feed = this.feeds[i]
        if (!this.feedStats[feed.id] || !this.matchesTags(feed)) continue

        var n = vm.feedStats[feed.id][filter] || 0
        if (filter == "unread") n += vm.feedStats[feed.id]["starred"]

        if (!statsFolders[feed.folder_id]) statsFolders[feed.folder_id] = 0

        statsFeeds[feed.id] = n
        statsFolders[feed.folder_id] += n
        statsTotal += n
      }

      this.filteredFeedStats = statsFeeds
      this.filteredFolderStats = statsFolders
      this.filteredTotalStats = statsTotal
    },
  }
})

vm.$mount('#app')
