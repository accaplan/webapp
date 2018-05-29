import Immutable from 'immutable'
import { camelizeKeys } from 'humps'
import * as ACTION_TYPES from '../constants/action_types'

// Like .getIn but for regular JS objects
// Does not break if object is missing a key in the middle
// TODO: Immutable 4.x has a functional getIn that works on both Maps and objects.
function deepGet(object, [head, ...tail], fallback = null) {
  const val = object[head]
  if (val === undefined || val === null) { return fallback }
  if (tail.length === 0) { return val }
  return deepGet(val, tail, fallback)
}

// Merge two Immutable maps while preferring data over nulls and never returning undefined.
function smartMergeDeep(oldMap, newMap) {
  const filteredNewMap = newMap.filterNot(v => v === undefined || v === null)
  return oldMap.mergeDeepWith((oldVal, newVal) => {
    if (oldVal === undefined && newVal === undefined) { return null }
    if (oldVal === null || oldVal === undefined) { return newVal }
    return newVal
  }, filteredNewMap)
}

// Given state (immutable), a key path (array[string]), and map merge the map in.
// If a value on either side is null or undefined it "loses" the merge - we always prefer data.
function smartMergeDeepIn(state, keyPath, newMap) {
  const oldMap = state.getIn(keyPath, Immutable.Map())
  const mergedMap = smartMergeDeep(oldMap, newMap)
  return state.setIn(keyPath, mergedMap)
}

function parseList(state, list, parser) {
  if (!Array.isArray(list)) { return state }
  return list.reduce(parser, state)
}

function parsePagination(state, models, next, isLastPage, pathname, query, variables) {
  const mergedState = state.mergeDeepIn(['pages', pathname], Immutable.fromJS({
    pagination: Immutable.fromJS({ next, query, variables, isLastPage }),
  }))
  return mergedState.updateIn(['pages', pathname, 'ids'], (existingPageIds) => {
    const newPageIds = Immutable.OrderedSet(models.map(m => m.id))
    // If we don't have any existingPageIds just return the new ids.
    if (!existingPageIds || existingPageIds.count() === 0) {
      return newPageIds
    }
    // If we have a before value in the query this is not the first page, so append to ordered set.
    if (variables.before || (variables.get && variables.get('before'))) {
      return existingPageIds.concat(newPageIds)
    }
    // If we don't have a before value this is either the first page or re-requesting the first
    // page. In that case we need to prepend to the ordered set.
    return newPageIds.concat(existingPageIds)
  })
}

function resetSubscribedStreamPagination(state) {
  return state.deleteIn(['pages', '/discover/subscribed'])
    .deleteIn(['pages', '/discover/subscribed/trending'])
    .deleteIn(['pages', '/discover/subscribed/recent'])
}

function parseAsset(state, asset) {
  if (!asset) { return state }
  return smartMergeDeepIn(state, ['assets', asset.id], Immutable.fromJS({
    id: asset.id,
    attachment: asset.attachment,
  }))
}

function reduceAssets(assets) {
  return (assets || []).reduce((byId, asset) => (
      { ...byId, [asset.id]: asset }
    ), {})
}

function parseCategory(state, category) {
  if (!category) { return state }
  return smartMergeDeepIn(state, ['categories', category.id], Immutable.fromJS({
    id: category.id,
    slug: category.slug,
    name: category.name,
    level: category.level,
    order: category.order,
    allowInOnboarding: category.allowInOnboarding,
    isCreatorType: category.isCreatorType,
    tileImage: category.tileImage,
  }))
}

function parseCategoryPost(state, categoryPost) {
  if (!categoryPost) { return state }
  const state2 = parseCategory(state, categoryPost.category)
  return smartMergeDeepIn(state2, ['categoryPosts', categoryPost.id], Immutable.fromJS({
    id: categoryPost.id,
    status: categoryPost.status,
    submittedAt: categoryPost.submittedAt,
    submittedByUsername: deepGet(categoryPost, ['submittedBy', 'username']),
    featuredAt: categoryPost.featuredAt,
    featuredByUsername: deepGet(categoryPost, ['featuredBy', 'username']),
    categorySlug: deepGet(categoryPost, ['category', 'slug']),
    categoryName: deepGet(categoryPost, ['category', 'name']),
    categoryId: deepGet(categoryPost, ['category', 'id']),
    actions: categoryPost.actions,
  }))
}

function parseArtistInvite(state, invite) {
  if (!invite || !invite.id) { return state }
  return smartMergeDeepIn(state, ['artistInvites', invite.id], Immutable.fromJS({
    id: invite.id,
    title: invite.title,
    slug: invite.slug,
  }))
}

function parseArtistInviteSubmission(state, submission) {
  if (!submission || !submission.id) { return state }
  const state2 = parseArtistInvite(state, submission.artistInvite)
  return smartMergeDeepIn(state2, ['artistInviteSubmissions', submission.id], Immutable.fromJS({
    id: submission.id,
    status: submission.status,
    actions: submission.actions,
  }))
}

function parseUser(state, user) {
  if (!user) { return state }

  const state1 = smartMergeDeepIn(state, ['users', user.id], Immutable.fromJS({

    // Minumum properties
    id: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar,

    // Extended properties
    coverImage: user.coverImage,
    badges: user.badges,
    externalLinksLink: user.externalLinksLink,
    formattedShortBio: user.formattedShortBio,
    location: user.location,

    // Settings
    isCollaboratable: deepGet(user, ['settings', 'isCollaboratable']),
    isHireable: deepGet(user, ['settings', 'isHireable']),
    hasCommentingEnabled: deepGet(user, ['settings', 'hasCommentingEnabled']),
    hasLovesEnabled: deepGet(user, ['settings', 'hasLovesEnabled']),
    hasRepostingEnabled: deepGet(user, ['settings', 'hasRepostingEnabled']),
    hasSharingEnabled: deepGet(user, ['settings', 'hasSharingEnabled']),
    postsAdultContent: deepGet(user, ['settings', 'postAdultContent']),

    // userStats
    followersCount: deepGet(user, ['userStats', 'followersCount']),
    followingCount: deepGet(user, ['userStats', 'followingCount']),
    postsCount: deepGet(user, ['userStats', 'postsCount']),
    lovesCount: deepGet(user, ['userStats', 'lovesCount']),
    totalViewsCount: deepGet(user, ['userStats', 'totalViewsCount']),

    // currentUserState
    relationshipPriority: deepGet(user, ['currentUserState', 'relationshipPriority']),
  }))
  const state2 = parseList(state1, user.categories, parseCategory)
  return state2
}

function parsePageHeader(state, pageHeader) {
  if (!pageHeader) { return state }
  const state1 = parseUser(state, pageHeader.user)
  const state2 = parseCategory(state1, pageHeader.category)
  return smartMergeDeepIn(state2, ['pageHeaders', pageHeader.id], Immutable.fromJS({
    id: pageHeader.id,
    kind: pageHeader.kind,
    slug: pageHeader.slug,
    postToken: pageHeader.postToken,
    header: pageHeader.header,
    subheader: pageHeader.subheader,
    ctaLink: pageHeader.ctaLink,
    image: pageHeader.image,
    userId: deepGet(pageHeader, ['user', 'id']),
    categoryId: deepGet(pageHeader, ['category', 'id']),
  }))
}

function postLinks(post) {
  const links = {}
  const authorId = deepGet(post, ['author', 'id'])
  if (authorId) { links.author = { id: authorId, type: 'user' } }

  const repostAuthorId = deepGet(post, ['repostedSource', 'author', 'id'])
  if (repostAuthorId) { links.repostAuthor = { id: repostAuthorId, type: 'user' } }

  const repostId = deepGet(post, ['repostedSource', 'id'])
  if (repostId) { links.repostedSource = { id: repostId, type: 'post' } }

  const categories = deepGet(post, ['categories'])
  if (categories && !!categories.length) {
    links.categories = categories.map(cat => cat.id)
  }

  const categoryPosts = deepGet(post, ['categoryPosts'])
  if (categoryPosts && !!categoryPosts.length) {
    links.categoryPosts = categoryPosts.map(cp => cp.id)
    links.categories = categoryPosts.map(cp => (cp.category ? cp.category.id : null))
  }

  return links
}

// Camelize data keys, inject assets objects into appropriate region
function parseRegion(post, type, assetsById) {
  return (post[type] || []).map((region, index) => {
    const id = `${post.id}-${index}`
    const assetId = deepGet(region, ['links', 'assets'])
    const asset = assetsById[assetId]
    let data = null
    if (typeof region.data === 'object') {
      data = camelizeKeys(region.data)
    } else {
      data = region.data
    }
    if (region.kind === 'image' && typeof assetId === 'string' && asset) {
      return { ...region, data, id, asset }
    }
    return { ...region, data, id }
  })
}

function parsePost(state, post) {
  if (!post) { return state }

  const state1 = parseUser(state, post.author)
  const state2 = parseList(state1, post.assets, parseAsset)
  const state3 = parsePost(state2, post.repostedSource)
  const state4 = parseArtistInviteSubmission(state3, post.artistInviteSubmission)
  const state5 = parseList(state4, post.categories, parseCategory)
  const state6 = parseList(state5, post.categoryPosts, parseCategoryPost)

  const assetsById = reduceAssets(post.assets)
  const repostAssetsById = post.repostedSource ? reduceAssets(post.repostedSource.assets) : null

  return smartMergeDeepIn(state6, ['posts', post.id], Immutable.fromJS({
    // ids
    id: post.id,
    authorId: deepGet(post, ['author', 'id']), // We don't use links for this

    // Properties
    token: post.token,
    createdAt: post.createdAt,
    artistInviteId: deepGet(post, ['artistInviteSubmission', 'artistInvite', 'id']),
    artistInviteSubmissionId: deepGet(post, ['artistInviteSubmission', 'id']),

    // Content
    summary: parseRegion(post, 'summary', assetsById),
    content: parseRegion(post, 'content', assetsById),
    repostContent: parseRegion(post, 'repostContent', repostAssetsById),

    // Stats
    lovesCount: deepGet(post, ['postStats', 'lovesCount']),
    commentsCount: deepGet(post, ['postStats', 'commentsCount']),
    viewsCount: deepGet(post, ['postStats', 'viewsCount']),
    repostsCount: deepGet(post, ['postStats', 'repostsCount']),

    // Current user state
    watching: deepGet(post, ['currentUserState', 'watching']),
    loved: deepGet(post, ['currentUserState', 'loved']),
    reposted: deepGet(post, ['currentUserState', 'reposted']),

    // Links
    links: postLinks(post),
  }))
}

function editorialLinks(editorial) {
  const links = {}
  const postId = deepGet(editorial, ['post', 'id'])
  if (postId) { links.post = { id: postId, type: 'post' } }

  const { query, ...variables } = editorial.stream || {}
  if (query) { links.postStream = { query, variables } }

  return links
}

function parseEditorial(state, editorial) {
  if (!editorial) { return state }
  const state1 = parsePost(state, editorial.post)
  return smartMergeDeepIn(state1, ['editorials', editorial.id], Immutable.fromJS({
    id: editorial.id,
    kind: editorial.kind ? editorial.kind.toLowerCase() : null,
    title: editorial.title,
    renderedSubtitle: editorial.subtitle,
    oneByOneImage: editorial.oneByOneImage,
    oneByTwoImage: editorial.oneByTwoImage,
    twoByOneImage: editorial.twoByOneImage,
    twoByTwoImage: editorial.twoByTwoImage,
    url: editorial.url,
    path: editorial.path,
    links: editorialLinks(editorial),
  }))
}

function parsePostDetail(state, { payload: { response: { data: { post } } } }) {
  return parsePost(state, post)
}

function parseQueryType(state, type, stream, pathname, query, variables) {
  const { next, isLastPage } = stream
  let models
  let parser
  switch (type) {
    case 'globalPostStream':
    case 'categoryPostStream':
    case 'subscribedPostStream':
    case 'userPostStream':
      models = stream.posts
      parser = parsePost
      break;
    case 'editorialStream':
      models = stream.editorials
      parser = parseEditorial
      break;
    default:
      models = null
      parser = null

  }
  const state1 = parseList(state, models, parser)
  return parsePagination(state1, models, next, isLastPage, pathname, query, variables)
}

function parseStream(state, { payload: { response: { data }, pathname, query, variables } }) {
  return Object.keys(data).reduce((s, key) =>
    parseQueryType(s, key, data[key], pathname, query, variables),
    state,
  )
}

function parseCategoryQueries(state, { payload: { response: { data } } }) {
  return parseList(state, data.categoryNav || data.allCategories, parseCategory)
}

function parsePageHeaders(state, { payload: { response: { data: { pageHeaders } } } }) {
  return parseList(state, pageHeaders, parsePageHeader)
}

function parseLoadManyPosts(state, action) {
  const { meta, payload: { response: { data: { findPosts: posts } } } } = action
  const state1 = parseList(state, posts, parsePost)
  if (meta.resultKey) {
    return state1.mergeDeepIn(['pages', meta.resultKey], Immutable.fromJS({
      pagination: { isLastPage: true },
      ids: Immutable.OrderedSet(posts.map(p => p.id)),
    }))
  }
  return state1
}

// Dispatch different graphql response types for parsing (reducing)
export default function (state, action) {
  const { type } = action
  switch (type) {
    case ACTION_TYPES.V3.LOAD_STREAM_SUCCESS:
    case ACTION_TYPES.V3.LOAD_NEXT_CONTENT_SUCCESS:
      return parseStream(state, action)
    case ACTION_TYPES.V3.LOAD_CATEGORIES_SUCCESS:
      return parseCategoryQueries(state, action)
    case ACTION_TYPES.V3.LOAD_PAGE_HEADERS_SUCCESS:
      return parsePageHeaders(state, action)
    case ACTION_TYPES.V3.POST.DETAIL_SUCCESS:
      return parsePostDetail(state, action)
    case ACTION_TYPES.V3.POST.LOAD_MANY_SUCCESS:
      return parseLoadManyPosts(state, action)
    case ACTION_TYPES.PROFILE.FOLLOW_CATEGORIES_SUCCESS:
    case ACTION_TYPES.PROFILE.UNFOLLOW_CATEGORIES_SUCCESS:
      return resetSubscribedStreamPagination(state)
    default:
      return state
  }
}
