function scrollto(target, scroll) {
  var padding = 10
  var targetRect = target.getBoundingClientRect()
  var scrollRect = scroll.getBoundingClientRect()

  // target
  var relativeOffset = targetRect.y - scrollRect.y
  var absoluteOffset = relativeOffset + scroll.scrollTop

  if (padding <= relativeOffset && relativeOffset + targetRect.height <= scrollRect.height - padding) return

  var newPos = scroll.scrollTop
  if (relativeOffset < padding) {
    newPos = absoluteOffset - padding
  } else {
    newPos = absoluteOffset - scrollRect.height + targetRect.height + padding
  }
  scroll.scrollTop = Math.round(newPos)
}

var helperFunctions = {
  // navigation helper, navigate relative to selected item
  navigateToItem: function(relativePosition) {
    if (vm.itemSelected == null) {
      // if no item is selected, select first
      if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
      return
    }

    var itemPosition = vm.items.findIndex(function(x) { return x.id === vm.itemSelected })
    if (itemPosition === -1) {
      if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
      return
    }

    var newPosition = itemPosition + relativePosition
    if (newPosition < 0 || newPosition >= vm.items.length) return

    vm.itemSelected = vm.items[newPosition].id

    vm.$nextTick(function() {
      var scroll = document.querySelector('#item-list-scroll')

      var handle = scroll.querySelector('input[type=radio]:checked')
      var target = handle && handle.parentElement

      if (target && scroll) scrollto(target, scroll)
    })
  },
  // navigation helper, navigate relative to selected feed
  navigateToFeed: function(relativePosition) {
    var navigationList = Array.from(document.querySelectorAll('#col-feed-list input[name=feed]'))
      .filter(function(r) { return r.offsetParent !== null && r.value !== 'folder:null' })
      .map(function(r) { return r.value })

    var currentFeedPosition = navigationList.indexOf(vm.feedSelected)

    if (currentFeedPosition == -1) {
      vm.feedSelected = ''
      return
    }

    var newPosition = currentFeedPosition+relativePosition
    if (newPosition < 0 || newPosition >= navigationList.length) return

    vm.feedSelected = navigationList[newPosition]

    vm.$nextTick(function() {
      var scroll = document.querySelector('#feed-list-scroll')

      var handle = scroll.querySelector('input[type=radio]:checked')
      var target = handle && handle.parentElement

      if (target && scroll) scrollto(target, scroll)
    })
  },
  scrollContent: function(direction) {
    var padding = 40
    var scroll = document.querySelector('.content')
    if (!scroll) return

    var height = scroll.getBoundingClientRect().height
    var newpos = scroll.scrollTop + (height/2 - padding) * direction

    if (typeof scroll.scrollTo == 'function') {
      scroll.scrollTo({top: newpos, left: 0})
    } else {
      scroll.scrollTop = newpos
    }
  }
}
var shortcutFunctions = {
  openItemLink: function() {
    if (vm.itemSelectedDetails && vm.itemSelectedDetails.link) {
      window.open(vm.itemSelectedDetails.link, '_blank')
    }
  },
  toggleReadability: function() {
    vm.toggleReadability()
  },
  toggleItemRead: function() {
    if (vm.itemSelected != null) {
      vm.toggleItemRead(vm.itemSelectedDetails)
    }
  },
  markAllRead: function() {
    // same condition as 'Mark all read button'
    if (vm.filterSelected == 'unread'){
      vm.markItemsRead()
    }
  },
  toggleItemStarred: function() {
    if (vm.itemSelected != null) {
      vm.toggleItemStarred(vm.itemSelectedDetails)
    }
  },
  focusSearch: function() {
    document.getElementById("searchbar").focus()
  },
  nextItem(){
    helperFunctions.navigateToItem(+1)
  },
  previousItem() {
    helperFunctions.navigateToItem(-1)
  },
  nextFeed(){
    helperFunctions.navigateToFeed(+1)
  },
  previousFeed() {
    helperFunctions.navigateToFeed(-1)
  },
  scrollForward: function() {
    helperFunctions.scrollContent(+1)
  },
  scrollBackward: function() {
    helperFunctions.scrollContent(-1)
  },
  scrollTop: function() {
    var scroll = document.querySelector('.content')
    scroll.scrollTop = 0
  },
  scrollBottom: function() {
    var scroll = document.querySelector('.content')
    scroll.scrollTop = scroll.scrollHeight
  },
  showAll() {
    vm.filterSelected = ''
  },
  showUnread() {
    vm.filterSelected = 'unread'
  },
  showStarred() {
    vm.filterSelected = 'starred'
  },
  unselectFeed() {
    vm.feedSelected = ""
  },
  openFuzzyFinder() {
    if (vm.fuzzyEnabled) {
      return
    }
    vm.fuzzySearchQuery = ''
    vm.fuzzyFeeds = vm.feeds
    vm.fuzzyEnabled = true
    vm.fuzzyItemSelected = -1
    Vue.nextTick().then(function() {
      document.querySelector('#fuzzySearch').focus()
    })
  }
}

// If you edit, make sure you update the help modal
var keybindings = {
  "o": shortcutFunctions.openItemLink,
  "i": shortcutFunctions.toggleReadability,
  "r": shortcutFunctions.toggleItemRead,
  "R": shortcutFunctions.markAllRead,
  "s": shortcutFunctions.toggleItemStarred,
  "/": shortcutFunctions.focusSearch,
  "j": shortcutFunctions.nextItem,
  "k": shortcutFunctions.previousItem,
  "l": shortcutFunctions.nextFeed,
  "h": shortcutFunctions.previousFeed,
  "f": shortcutFunctions.scrollForward,
  "b": shortcutFunctions.scrollBackward,
  "g": shortcutFunctions.scrollTop,
  "G": shortcutFunctions.scrollBottom,
  "1": shortcutFunctions.showUnread,
  "2": shortcutFunctions.showStarred,
  "3": shortcutFunctions.showAll,
  "0": shortcutFunctions.unselectFeed,
  "p": shortcutFunctions.openFuzzyFinder,
}

function isTextBox(element) {
  var tagName = element.tagName.toLowerCase()
  // Input elements that aren't text
  var inputBlocklist = ['button','checkbox','color','file','hidden','image','radio','range','reset','search','submit']

  return tagName === 'textarea' ||
    ( tagName === 'input'
      && inputBlocklist.indexOf(element.getAttribute('type').toLowerCase()) == -1
    )
}

document.addEventListener('keydown',function(event) {
  if (vm.fuzzyEnabled) {
    if (event.key == "ArrowUp" || event.key == "ArrowDown") {
      let prev = vm.fuzzyItemSelected
      let delta = event.key == "ArrowUp" ? -1 : 1
      event.preventDefault()
      vm.fuzzyItemSelected += delta
      let searchResults = document.querySelectorAll("#fuzzySearchResults > label")
      if (prev > -1) {
        searchResults[prev].setAttribute("selected", false)
      }
      if (vm.fuzzyItemSelected <= -1) {
        vm.fuzzyItemSelected = -1
        document.querySelector('#fuzzySearch').focus()
      } else {
        document.querySelector('#fuzzySearch').blur()
        if (vm.fuzzyItemSelected >= searchResults.length) {
          vm.fuzzyItemSelected = 0
        }
        searchResults[vm.fuzzyItemSelected].setAttribute("selected", true)
        searchResults[vm.fuzzyItemSelected].scrollIntoViewIfNeeded()
        console.log(vm.fuzzyItemSelected)
      }
    }
    else if (event.key == "Enter") {
      if (vm.fuzzyItemSelected == -1) vm.fuzzyItemSelected = 0
      let searchResults = document.querySelectorAll("#fuzzySearchResults > label")
      searchResults[vm.fuzzyItemSelected].click()
    }
  }
  // Ignore while focused on text or
  // when using modifier keys (to not clash with browser behaviour)
  if (isTextBox(event.target) || event.metaKey || event.ctrlKey) {
    return
  }
  var keybindFunction = keybindings[event.key]
  if (keybindFunction) {
    event.preventDefault()
    keybindFunction()
  }
})
