import React from 'react'
import { mergeClassNames } from '../base/utils'
import { ChevronIcon } from '../iconography/Icons'

export class PaddleButton extends React.Component {
  displayName() {
    return 'PaddleButton'
  }

  render() {
    const klasses = mergeClassNames(this.props, this.displayName())
    return (
      <button {...this.props} className={klasses} type="button">
        <ChevronIcon/>
      </button>
    )
  }
}

