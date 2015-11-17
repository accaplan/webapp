import React from 'react'
import Avatar from '../users/Avatar'
import UserAvatars from '../users/UserAvatars'
import UserCard from '../users/UserCard'
import UserGrid from '../users/UserGrid'
import { parseNotification } from '../parsers/NotificationParser'
import { parsePost } from '../parsers/PostParser'
import { getLinkArray } from '../base/json_helper'
import * as api from '../../networking/api'
import { BubbleIcon, HeartIcon, RepostIcon } from '../posts/PostIcons'

export function onboardingCommunities(users) {
  return (
    <div className="Cards">
      {users.data.map((user, i) => {
        return <UserCard ref={'userCard_' + i} user={user} key={i} />
      })}
    </div>
  )
}

export function onboardingPeople(users) {
  return (
    <div className="Users asGrid">
      {users.data.map((user, i) => {
        return <UserGrid ref={'userGrid_' + i} user={user} key={i} />
      })}
    </div>
  )
}

export function postsAsGrid(posts, json, currentUser) {
  return (
    <div className="Posts asGrid">
      {posts.data.map((post) => {
        return (
          <div ref={`postGrid_${post.id}`} key={post.id} className="Post PostGrid">
            {parsePost(post, json, currentUser)}
          </div>
        )
      })}
    </div>
  )
}

export function postsAsList(posts, json, currentUser) {
  return (
    <div className="Posts asList">
      {posts.data.map((post) => {
        return (
          <div ref={`postList_${post.id}`} key={post.id} className="Post PostList">
            {parsePost(post, json, currentUser)}
          </div>
        )
      })}
    </div>
  )
}

export function userDetail(users, json, currentUser) {
  const user = users.data[0]
  let posts = getLinkArray(user, 'posts', json) || []
  posts = posts.concat(users.nestedData)
  return (
    <div className="UserDetail">
      <UserGrid ref={'userGrid_' + user.id} user={user} key={user.id} />
      {postsAsList({data: posts, nestedData: []}, json, currentUser)}
    </div>
  )
}

export function postDetail(posts, json, currentUser) {
  const post = posts.data[0]
  let comments = getLinkArray(post, 'comments', json) || []
  comments = comments.concat(posts.nestedData)
  const avatarDrawers = []
  if (Number(post.lovesCount) > 0) {
    avatarDrawers.push(<UserAvatars endpoint={api.postLovers(post)} icon={<HeartIcon />} key={`lovers_${post.id}`} resultKey="lovers" />)
  }
  if (Number(post.repostsCount) > 0) {
    avatarDrawers.push(<UserAvatars endpoint={api.postReposters(post)} icon={<RepostIcon />} key={`reposters_${post.id}`} resultKey="reposters" />)
  }
  return (
    <div className="PostDetail Posts asList">
      <div ref={`postList_${post.id}`} key={post.id} className="Post PostList">
        {parsePost(post, json, currentUser, false)}
        {avatarDrawers}
        <section className="Comments">
          <BubbleIcon/>
          {comments.map((comment) => {
            return (
              <div ref={`commentList_${comment.id}`} key={comment.id} className="CommentList">
                {parsePost(comment, json, currentUser, false)}
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}

export function notificationList(notifications, json, currentUser) {
  return (
    <div className="Notifications">
      {notifications.data.map((notification) => {
        return parseNotification(notification, json, currentUser)
      })}
    </div>
  )
}

export function userAvatars(users) {
  return (
    users.data.map((user) => {
      return <Avatar imgSrc={user.avatar ? user.avatar.regular.url : ''} path={`/${user.username}`} key={`userAvatar_${user.id}`}/>
    })
  )
}

