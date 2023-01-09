import { useResponsiveProp } from '@shopify/restyle'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import 'react-native-gesture-handler'
import { useAppDispatch, useAppTheme } from 'src/app/hooks'
import { navigate } from 'src/app/navigation/rootNavigation'
import InformationIcon from 'src/assets/icons/i-icon.svg'
import PlusIcon from 'src/assets/icons/plus.svg'
import SettingsIcon from 'src/assets/icons/settings.svg'
import { AccountList } from 'src/components/accounts/AccountList'
import { TouchableArea } from 'src/components/buttons/TouchableArea'
import { Box, Flex } from 'src/components/layout'
import { Screen } from 'src/components/layout/Screen'
import { Separator } from 'src/components/layout/Separator'
import { ActionSheetModal, MenuItemProp } from 'src/components/modals/ActionSheetModal'
import { BottomSheetModal } from 'src/components/modals/BottomSheetModal'
import { WarningSeverity } from 'src/components/modals/WarningModal/types'
import WarningModal, {
  captionForAccountRemovalWarning,
} from 'src/components/modals/WarningModal/WarningModal'
import { Text } from 'src/components/Text'
import { closeModal } from 'src/features/modals/modalSlice'
import { pushNotification } from 'src/features/notifications/notificationSlice'
import { AppNotificationType } from 'src/features/notifications/types'
import { ImportType, OnboardingEntryPoint } from 'src/features/onboarding/utils'
import { ElementName, ModalName } from 'src/features/telemetry/constants'
import { Account, AccountType, SignerMnemonicAccount } from 'src/features/wallet/accounts/types'
import { createAccountActions } from 'src/features/wallet/createAccountSaga'
import { EditAccountAction, editAccountActions } from 'src/features/wallet/editAccountSaga'
import {
  useAccounts,
  useActiveAccountWithThrow,
  useNativeAccountExists,
} from 'src/features/wallet/hooks'
import {
  PendingAccountActions,
  pendingAccountActions,
} from 'src/features/wallet/pendingAcccountsSaga'
import { activateAccount } from 'src/features/wallet/walletSlice'
import { OnboardingScreens, Screens } from 'src/screens/Screens'
import { setClipboard } from 'src/utils/clipboard'

export function AccountSwitcherModal() {
  const dispatch = useAppDispatch()

  return (
    <BottomSheetModal
      disableSwipe
      name={ModalName.AccountSwitcher}
      onClose={() => dispatch(closeModal({ name: ModalName.AccountSwitcher }))}>
      <Screen edges={['bottom']}>
        <AccountSwitcher
          onClose={() => {
            dispatch(closeModal({ name: ModalName.AccountSwitcher }))
          }}
        />
      </Screen>
    </BottomSheetModal>
  )
}

function AccountSwitcher({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const theme = useAppTheme()

  const activeAccount = useActiveAccountWithThrow()
  const addressToAccount = useAccounts()
  const dispatch = useAppDispatch()
  const hasImportedSeedPhrase = useNativeAccountExists()

  const [showAddWalletModal, setShowAddWalletModal] = useState(false)
  const [showEditAccountModal, setShowEditAccountModal] = useState(false)
  const [showUninstallToImportModal, setShowUninstallToImportModal] = useState(false)
  const [pendingEditAddress, setPendingEditAddress] = useState<Address | null>(null)
  const [pendingRemoveAccount, setPendingRemoveAccount] = useState<Account | null>(null)

  const addAccountBottomMargin = useResponsiveProp({ xs: 'md', sm: 'none' })

  const { accountsData, mnemonicWallets } = useMemo(() => {
    const accounts = Object.values(addressToAccount)
    const _mnemonicWallets = accounts
      .filter((a) => a.type === AccountType.SignerMnemonic)
      .sort((a, b) => {
        return (
          (a as SignerMnemonicAccount).derivationIndex -
          (b as SignerMnemonicAccount).derivationIndex
        )
      })
    const _viewOnlyWallets = accounts
      .filter((a) => a.type === AccountType.Readonly)
      .sort((a, b) => {
        return a.timeImportedMs - b.timeImportedMs
      })
    return {
      accountsData: [..._mnemonicWallets, ..._viewOnlyWallets],
      mnemonicWallets: _mnemonicWallets,
    }
  }, [addressToAccount])

  const onPressEdit = useCallback((address: Address) => {
    setShowEditAccountModal(true)
    setPendingEditAddress(address)
  }, [])

  const onPressEditCancel = () => {
    setShowEditAccountModal(false)
    setPendingEditAddress(null)
  }

  const onPressRemoveCancel = () => {
    setPendingRemoveAccount(null)
  }
  const onPressRemoveConfirm = () => {
    if (!pendingRemoveAccount) return
    dispatch(
      editAccountActions.trigger({
        type: EditAccountAction.Remove,
        address: pendingRemoveAccount.address,
        notificationsEnabled:
          !!addressToAccount[pendingRemoveAccount.address]?.pushNotificationsEnabled,
      })
    )
    setPendingRemoveAccount(null)
    onPressEditCancel() // Dismiss bottom sheet
  }

  const onPressAccount = useCallback(
    (address: Address) => {
      dispatch(closeModal({ name: ModalName.AccountSwitcher }))
      dispatch(activateAccount(address))
    },
    [dispatch]
  )

  const onPressAddWallet = () => {
    setShowAddWalletModal(true)
  }

  const onCloseAddWallet = () => {
    setShowAddWalletModal(false)
  }

  const onPressSettings = () => {
    navigate(Screens.SettingsStack, { screen: Screens.Settings })
    onClose()
  }

  const editAccountOptions = useMemo<MenuItemProp[]>(() => {
    const onPressWalletSettings = () => {
      setShowEditAccountModal(false)
      if (!pendingEditAddress) return
      navigate(Screens.SettingsStack, {
        screen: Screens.SettingsWallet,
        params: { address: pendingEditAddress },
      })
    }

    const onPressCopyAddress = () => {
      if (!pendingEditAddress) return
      setClipboard(pendingEditAddress)
      dispatch(pushNotification({ type: AppNotificationType.Copied }))
      setShowEditAccountModal(false)
    }

    const onPressRemove = () => {
      if (!pendingEditAddress) return
      const account = addressToAccount[pendingEditAddress]
      if (!account) return
      setShowEditAccountModal(false)
      setPendingRemoveAccount(account)
    }

    const editWalletOptions = [
      {
        key: ElementName.WalletSettings,
        onPress: onPressWalletSettings,
        render: () => (
          <Box
            alignItems="center"
            borderBottomColor="backgroundOutline"
            borderBottomWidth={1}
            p="md">
            <Text variant="bodyLarge">{t('Wallet settings')}</Text>
          </Box>
        ),
      },
      {
        key: ElementName.Copy,
        onPress: onPressCopyAddress,
        render: () => (
          <Box
            alignItems="center"
            borderBottomColor="backgroundOutline"
            borderBottomWidth={shouldHideRemoveOption ? 0 : 1}
            p="md">
            <Text variant="bodyLarge">{t('Copy wallet address')}</Text>
          </Box>
        ),
      },
    ]

    // Should not show remove option if we have only one account remaining, or only one seed phrase wallet remaining
    const shouldHideRemoveOption =
      accountsData.length === 1 ||
      (mnemonicWallets.length === 1 &&
        !!pendingEditAddress &&
        addressToAccount[pendingEditAddress]?.type === AccountType.SignerMnemonic)

    if (!shouldHideRemoveOption) {
      editWalletOptions.push({
        key: ElementName.Remove,
        onPress: onPressRemove,
        render: () => (
          <Box alignItems="center" p="md">
            <Text color="accentCritical" variant="bodyLarge">
              {t('Remove wallet')}
            </Text>
          </Box>
        ),
      })
    }
    return editWalletOptions
  }, [
    accountsData.length,
    mnemonicWallets.length,
    pendingEditAddress,
    addressToAccount,
    dispatch,
    t,
  ])

  const addWalletOptions = useMemo<MenuItemProp[]>(() => {
    const onPressCreateNewWallet = () => {
      // Clear any existing pending accounts first.
      dispatch(pendingAccountActions.trigger(PendingAccountActions.DELETE))
      dispatch(createAccountActions.trigger())

      navigate(Screens.OnboardingStack, {
        screen: OnboardingScreens.EditName,
        params: {
          importType: hasImportedSeedPhrase ? ImportType.CreateAdditional : ImportType.CreateNew,
          entryPoint: OnboardingEntryPoint.Sidebar,
        },
      })
      setShowAddWalletModal(false)
      onClose()
    }

    const onPressAddViewOnlyWallet = () => {
      navigate(Screens.OnboardingStack, {
        screen: OnboardingScreens.WatchWallet,
        params: {
          importType: ImportType.Watch,
          entryPoint: OnboardingEntryPoint.Sidebar,
        },
      })
      setShowAddWalletModal(false)
      onClose()
    }

    const onPressImportWallet = () => {
      if (hasImportedSeedPhrase) {
        // Show warning modal that the only way to reimport seed phrase is to uninstall and reinstall app
        setShowUninstallToImportModal(true)
        return
      }

      navigate(Screens.OnboardingStack, {
        screen: OnboardingScreens.ImportMethod,
        params: { entryPoint: OnboardingEntryPoint.Sidebar },
      })

      setShowAddWalletModal(false)
      onClose()
    }

    return [
      {
        key: ElementName.CreateAccount,
        onPress: onPressCreateNewWallet,
        render: () => (
          <Box
            alignItems="center"
            borderBottomColor="backgroundOutline"
            borderBottomWidth={1}
            p="md">
            <Text variant="bodyLarge">{t('Create a new wallet')}</Text>
          </Box>
        ),
      },
      {
        key: ElementName.AddViewOnlyWallet,
        onPress: onPressAddViewOnlyWallet,
        render: () => (
          <Box alignItems="center" p="md">
            <Text variant="bodyLarge">{t('Add a view-only wallet')}</Text>
          </Box>
        ),
      },
      {
        key: ElementName.ImportAccount,
        onPress: onPressImportWallet,
        render: () => (
          <Box alignItems="center" borderTopColor="backgroundOutline" borderTopWidth={1} p="md">
            <Text variant="bodyLarge">{t('Import a wallet')}</Text>
          </Box>
        ),
      },
    ]
  }, [dispatch, hasImportedSeedPhrase, onClose, t])

  if (!activeAccount.address) {
    return null
  }

  return (
    <Box mt="sm">
      <AccountList
        accounts={accountsData}
        onAddWallet={onPressAddWallet}
        onPress={onPressAccount}
        onPressEdit={onPressEdit}
      />

      <Separator mb="md" />

      <Flex gap="sm">
        <TouchableArea mb={addAccountBottomMargin} ml="lg" onPress={onPressAddWallet}>
          <Flex row alignItems="center">
            <Box
              alignItems="center"
              borderColor="backgroundOutline"
              borderRadius="full"
              borderWidth={1}
              justifyContent="center"
              p="xs">
              <PlusIcon
                color={theme.colors.textSecondary}
                height={theme.iconSizes.xs}
                width={theme.iconSizes.xs}
              />
            </Box>
            <Text color="textSecondary" variant="bodyLarge">
              {t('Add another wallet')}
            </Text>
          </Flex>
        </TouchableArea>
        <TouchableArea mb={addAccountBottomMargin} ml="lg" onPress={onPressSettings}>
          <Flex row alignItems="center">
            <Box p="xxs">
              <SettingsIcon
                color={theme.colors.textSecondary}
                height={theme.iconSizes.md}
                width={theme.iconSizes.md}
              />
            </Box>
            <Text color="textSecondary" variant="bodyLarge">
              {t('Settings')}
            </Text>
          </Flex>
        </TouchableArea>
      </Flex>

      <ActionSheetModal
        isVisible={showEditAccountModal}
        name={ModalName.AccountEdit}
        options={editAccountOptions}
        onClose={() => setShowEditAccountModal(false)}
      />
      <ActionSheetModal
        isVisible={showAddWalletModal}
        name={ModalName.AddWallet}
        options={addWalletOptions}
        onClose={onCloseAddWallet}
      />
      {!!pendingRemoveAccount && (
        <WarningModal
          useBiometric
          caption={captionForAccountRemovalWarning(pendingRemoveAccount.type, t)}
          closeText={t('Cancel')}
          confirmText={t('Remove')}
          modalName={ModalName.RemoveWallet}
          severity={WarningSeverity.High}
          title={t('Are you sure?')}
          onClose={onPressRemoveCancel}
          onConfirm={onPressRemoveConfirm}
        />
      )}
      {showUninstallToImportModal && (
        <WarningModal
          caption={t(
            'Uniswap Wallet can only store one recovery phrase at a time. In order to import a new recovery phrase, you have to re-install the app. Your current recovery phrase will be permanently deleted, so make sure you’ve backed it up first.'
          )}
          closeText={t('Close')}
          icon={<InformationIcon color={theme.colors.textSecondary} />}
          modalName={ModalName.ReimportUninstall}
          severity={WarningSeverity.None}
          title={t('Import a Wallet')}
          onClose={() => setShowUninstallToImportModal(false)}
        />
      )}
    </Box>
  )
}