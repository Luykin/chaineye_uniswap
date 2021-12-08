import { BackgroundColorShorthandProps } from '@shopify/restyle'
import React, { PropsWithChildren } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme, Theme } from 'src/styles/theme'

type Props = BackgroundColorShorthandProps<Theme>

const style = {
  flex: 1,
}

export function Screen(props: PropsWithChildren<Props>) {
  return (
    <SafeAreaView style={{ ...style, backgroundColor: theme.colors.mainBackground }} {...props}>
      {props.children}
    </SafeAreaView>
  )
}
