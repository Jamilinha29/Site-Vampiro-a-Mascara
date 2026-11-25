import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Error500Page } from '../../pages/errors/Error500Page'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] erro inesperado na árvore React:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <Error500Page />
        </div>
      )
    }
    return this.props.children
  }
}
