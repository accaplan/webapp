/* eslint-disable no-param-reassign */
import Immutable from 'immutable'
import { REHYDRATE } from 'redux-persist/constants'
import { LOCATION_CHANGE } from 'react-router-redux'
import {
  AUTHENTICATION,
  PROFILE,
  UPDATE_STATE_FROM_NATIVE,
} from '../constants/action_types'

export const initialState = Immutable.Map({
  accessToken: null,
  createdAt: null,
  expirationDate: null,
  expiresIn: null,
  isLoggedIn: false,
  refreshToken: null,
  tokenType: null,
  publicToken: Immutable.Map({
    accessToken: null,
    expiresIn: null,
    createdAt: null,
    tokenType: null,
  }),
})

export default (state = initialState, action) => {
  let auth
  switch (action.type) {
    case AUTHENTICATION.CLEAR_AUTH_TOKEN:
      return state.delete('accessToken').delete('expirationDate').delete('expiresIn')
    case AUTHENTICATION.PUBLIC_SUCCESS:
      auth = action.payload.response.token
      return state.set('publicToken', Immutable.Map({
        ...auth,
        expirationDate: new Date((auth.createdAt + auth.expiresIn) * 1000),
      }))
    case AUTHENTICATION.LOGOUT_SUCCESS:
    case AUTHENTICATION.LOGOUT_FAILURE:
    case AUTHENTICATION.REFRESH_FAILURE:
    case AUTHENTICATION.RESET_PASSWORD_SUCCESS:
    case PROFILE.DELETE_SUCCESS:
      return initialState
    case AUTHENTICATION.USER_SUCCESS:
    case AUTHENTICATION.REFRESH_SUCCESS:
    case PROFILE.SIGNUP_SUCCESS:
      auth = action.payload.response
      return state.merge({
        ...auth,
        expirationDate: new Date((auth.createdAt + auth.expiresIn) * 1000),
        isLoggedIn: true,
      })
    case AUTHENTICATION.NONCE_SUCCESS:
      auth = action.payload.response
      return state.merge({
        nonce: auth.nonce,
      })
    case LOCATION_CHANGE:
      if (window.nonImmutableState && window.nonImmutableState.authentication) {
        state = Immutable.fromJS(JSON.parse(window.nonImmutableState.authentication))
        delete window.nonImmutableState.authentication
        return state
      }
      return state
    case UPDATE_STATE_FROM_NATIVE: {
      if (!action.payload.authentication.isEmpty()) {
        return action.payload.authentication
      }
      return state
    }
    case REHYDRATE:
      auth = action.payload.authentication
      if (window.nonImmutableState && window.nonImmutableState.authentication) {
        auth = Immutable.fromJS(JSON.parse(window.nonImmutableState.authentication))
        delete window.nonImmutableState.authentication
      }
      if (auth) {
        return auth.set(
          'expirationDate', new Date((auth.get('createdAt') + auth.get('expiresIn')) * 1000),
        )
      }
      return state
    default:
      return state
  }
}

