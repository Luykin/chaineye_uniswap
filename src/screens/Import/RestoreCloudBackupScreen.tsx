import { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView } from 'react-native-gesture-handler'
import { useAppDispatch, useAppTheme } from 'src/app/hooks'
import { OnboardingStackParamList } from 'src/app/navigation/types'
import { TouchableArea } from 'src/components/buttons/TouchableArea'
import { Chevron } from 'src/components/icons/Chevron'
import { Flex } from 'src/components/layout'
import { Text } from 'src/components/Text'
import { Unicon } from 'src/components/unicons/Unicon'
import { useCloudBackups } from 'src/features/CloudBackup/hooks'
import { ICloudMnemonicBackup } from 'src/features/CloudBackup/types'
import { OnboardingScreen } from 'src/features/onboarding/OnboardingScreen'
import {
  PendingAccountActions,
  pendingAccountActions,
} from 'src/features/wallet/pendingAcccountsSaga'
import { OnboardingScreens } from 'src/screens/Screens'
import { shortenAddress } from 'src/utils/addresses'
import { formatDate } from 'src/utils/format'
import { useAddBackButton } from 'src/utils/useAddBackButton'

type Props = NativeStackScreenProps<OnboardingStackParamList, OnboardingScreens.RestoreCloudBackup>

export function RestoreCloudBackupScreen({ navigation, route: { params } }: Props): ReactElement {
  const { t } = useTranslation()
  const theme = useAppTheme()
  const dispatch = useAppDispatch()
  const backups = useCloudBackups()
  const sortedBackups = backups.slice().sort((a, b) => a.createdAt - b.createdAt)

  const onPressRestoreBackup = async (backup: ICloudMnemonicBackup): Promise<void> => {
    // Clear any existing pending accounts
    dispatch(pendingAccountActions.trigger(PendingAccountActions.DELETE))

    navigation.navigate({
      name: OnboardingScreens.RestoreCloudBackupPassword,
      params: { ...params, mnemonicId: backup.mnemonicId },
      merge: true,
    })
  }

  useAddBackButton(navigation)

  return (
    <OnboardingScreen
      subtitle={t('There are multiple recovery phrases backed up to your iCloud.')}
      title={t('Select backup to restore')}>
      <ScrollView>
        <Flex gap="xs">
          {sortedBackups.map((backup, index) => {
            const { mnemonicId, createdAt } = backup
            return (
              <TouchableArea
                key={backup.mnemonicId}
                backgroundColor="background2"
                borderColor="background3"
                borderRadius="lg"
                borderWidth={1}
                p="md"
                onPress={(): Promise<void> => onPressRestoreBackup(backup)}>
                <Flex row alignItems="center" justifyContent="space-between">
                  <Flex centered row gap="sm">
                    <Unicon address={mnemonicId} size={32} />
                    <Flex gap="none">
                      <Text numberOfLines={1} variant="subheadSmall">
                        {t('Backup {{backupIndex}}', { backupIndex: index + 1 })}
                      </Text>
                      <Text color="textSecondary" variant="buttonLabelMicro">
                        {shortenAddress(mnemonicId)}
                      </Text>
                    </Flex>
                  </Flex>
                  <Flex row gap="sm">
                    <Flex alignItems="flex-end" gap="xxs">
                      <Text color="textSecondary" variant="buttonLabelMicro">
                        {t('Backed up on:')}
                      </Text>
                      <Text variant="buttonLabelMicro">
                        {formatDate(new Date(createdAt * 1000))}
                      </Text>
                    </Flex>
                    <Chevron color={theme.colors.textPrimary} direction="e" />
                  </Flex>
                </Flex>
              </TouchableArea>
            )
          })}
        </Flex>
      </ScrollView>
    </OnboardingScreen>
  )
}