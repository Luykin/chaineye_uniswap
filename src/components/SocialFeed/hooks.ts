import { t } from '@lingui/macro'
import { parseRemoteActivities } from 'components/AccountDrawer/MiniPortfolio/Activity/parseRemote'
import { Activity, ActivityMap } from 'components/AccountDrawer/MiniPortfolio/Activity/types'
import {
  ActivityQuery,
  AssetChange,
  TransactionType,
  useActivityQuery,
} from 'graphql/data/__generated__/types-and-hooks'
import { AssetActivityDetails } from 'graphql/data/activity'
import { useFollowedAccounts } from 'pages/Profile'
import { useMemo } from 'react'
import { useFormatter } from 'utils/formatNumbers'

// Mock data for friends' activity.
export const friendsActivity = [
  {
    ensName: 'friend1.eth',
    address: '0x24791Cac57BF48328D9FE103Ce402Cfe4c0D8b07',
    description: 'Minted Azuki #2214',
    timestamp: Date.now(), // 1 hour ago
    image:
      'https://cdn.center.app/1/0xED5AF388653567Af2F388E6224dC7C4b3241C544/2214/92acd1de09f0f5e1c12a4f1b47306a8f7393f4053a32b439f5fc7ba8b797961e.png',
  },
  {
    address: '0x24791Cac57BF48328D9FE103Ce402Cfe4c0D8b07',
    description: 'Swapped 0.1 ETH for 100 DAI',
    timestamp: Date.now() - 1000 * 60 * 5, // 5 min ago
  },
  {
    ensName: 'friend1.eth',
    address: '0x24791Cac57BF48328D9FE103Ce402Cfe4c0D8b07',
    description: 'Swapped 0.1 ETH for 100 DAI',
    timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
  },
  // More activities...
]

enum JudgmentalTransaction {
  GOT_RUGGED,
  APED_INTO,
  DUMPED,
  STILL_HODLING,
  GAINS,
}
const JudgmentalTransactionTitleTable: { [key in JudgmentalTransaction]: string } = {
  [JudgmentalTransaction.GOT_RUGGED]: t`Got rugged by`,
  [JudgmentalTransaction.APED_INTO]: t`Aped into`,
  [JudgmentalTransaction.DUMPED]: t`Dumped`,
  [JudgmentalTransaction.STILL_HODLING]: t`Is still hodling`,
  [JudgmentalTransaction.GAINS]: t`Made gains on`,
}

function getProfit(buysAndSells: ReturnType<typeof useAllFriendsBuySells>['judgementalActivityMap'][string][string]) {
  let tokenName = ''

  const { buys, sells } = buysAndSells
  let profit = 0

  for (const buy of buys) {
    profit -= buy.USDValue
  }

  for (const sell of sells) {
    profit += sell.USDValue
    tokenName = sell.outputToken
  }

  console.log('cartcrom', buysAndSells, tokenName, profit)
  return profit
}

export type JudgementalActivity = { friend: string; description: string; asset: string; timestamp: number }

export function useFeed() {
  const { judgementalActivityMap: friendsBuysAndSells, normalActivityMap } = useAllFriendsBuySells()

  return useMemo(() => {
    const feed: (JudgementalActivity | Activity)[] = Object.values(normalActivityMap ?? {}) as Activity[]

    for (const friend in friendsBuysAndSells) {
      const friendsTradedTokens = friendsBuysAndSells[friend]
      for (const tokenAddress in friendsTradedTokens) {
        const userSold = friendsTradedTokens[tokenAddress].currentBalanceUSD === 0
        const profit = getProfit(friendsTradedTokens[tokenAddress])

        // console.log('cartcrom', tokenAddress, profit)

        const feedItemBase = { friend, timeStamp: Date.now() } // TODO(now) use time relevant to transaction
        if (profit < -100) {
          feed.push({
            ...feedItemBase,
            description: JudgmentalTransactionTitleTable[JudgmentalTransaction.GOT_RUGGED],
            asset: tokenAddress,
            timestamp: Date.now(),
          })
        } else if (profit > 200) {
          feed.push({
            ...feedItemBase,
            description: JudgmentalTransactionTitleTable[JudgmentalTransaction.GAINS],
            asset: tokenAddress,
            timestamp: Date.now(),
          })
        }
      }
    }
    return feed
  }, [friendsBuysAndSells, normalActivityMap])

  // console.log('cartcrom', feed)
}

// function getJudgmentalTransactionTitle(tx: TransactionDetails): string {
//   const changes: Readonly<TokenTransfer[]> = tx.assetChanges
//   for (const c of changes) {
//     if (c.transactedValue && c.transactedValue.value > 500) {
//       // fixme is value in bips? or usd?
//       return JudgmentalTransactionTitleTable[JudgmentalTransaction.APED_INTO]
//     }
//   }
// }

function assetIsEthStablecoin(symbol: string) {
  return symbol === 'USDT' || symbol === 'USDC' || symbol === 'DAI' || symbol === 'ETH' || symbol === 'WETH'
}

/* Returns allFriendsActivities in shape of [friend1Portfolio, friend2Portfolio]. Each portfolio contains attribute ownerAddress */
function useAllFriendsActivites(): {
  allFriendsActivities?: ActivityQuery
  loading: boolean
  refetch: () => Promise<any>
} {
  const followingAccounts = useFollowedAccounts()
  const {
    data: allFriendsActivities,
    loading,
    refetch,
  } = useActivityQuery({
    variables: { accounts: followingAccounts },
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
  })
  return { allFriendsActivities, loading, refetch }
}

export type BuySellMap = {
  [ownerAddress: string]: {
    [tokenAddress: string]: {
      buys: SwapInfo[]
      sells: SwapInfo[]
      currentBalanceUSD: number
    }
  }
}

type SwapInfo = {
  type: 'buy' | 'sell'
  inputToken: string
  outputToken: string
  txHash: string
  quantity: number
  USDValue: number
}

// Returns all activites by ownerAddress : tokenId : [buys & sells]
export function useAllFriendsBuySells(): { judgementalActivityMap: BuySellMap; normalActivityMap?: ActivityMap } {
  const { allFriendsActivities, loading } = useAllFriendsActivites()
  const { formatNumberOrString } = useFormatter()
  const normalActivityMap = parseRemoteActivities(
    formatNumberOrString,
    allFriendsActivities?.portfolios?.[0].assetActivities
  )
  const map: BuySellMap = {}
  if (loading) return { judgementalActivityMap: {}, normalActivityMap: {} }

  const friendBalanceMap = allFriendsActivities?.portfolios?.reduce((acc, curr) => {
    if (!curr) return acc
    if (!acc[curr.ownerAddress]) acc[curr.ownerAddress] = {}

    curr.tokenBalances?.forEach((balance) => {
      acc[curr.ownerAddress][balance.token?.address ?? 'NATIVE'] = balance.denominatedValue?.value ?? 0
    }, {})

    return acc
  }, {} as { [ownerAddress: string]: { [tokenAddress: string]: number } })

  allFriendsActivities?.portfolios?.map((portfolio) => {
    const buySells: BuySellMap[string] = {}

    for (const tx of portfolio.assetActivities ?? []) {
      const details: AssetActivityDetails = tx.details
      if (details.__typename === 'TransactionDetails' && details.type === TransactionType.Swap) {
        const transfers = details.assetChanges.filter((c) => c.__typename === 'TokenTransfer')
        if (transfers.length == 2) {
          // lol make our lives easier, ignore refund exact swaps for now
          for (let i = 0; i < 2; i++) {
            const assetChange = transfers[i]
            const otherAssetChange = transfers[i === 1 ? 0 : 1] as AssetChange
            if (assetChange.__typename === 'TokenTransfer' && otherAssetChange.__typename === 'TokenTransfer') {
              if (
                assetIsEthStablecoin(assetChange.asset.symbol ?? '') &&
                !assetIsEthStablecoin(otherAssetChange.asset.symbol ?? '')
              ) {
                const otherAssetAddress = otherAssetChange.asset.address ?? 'Other'

                if (!buySells[otherAssetAddress]) {
                  buySells[otherAssetAddress] = {
                    buys: [],
                    sells: [],
                    currentBalanceUSD: friendBalanceMap?.[portfolio.ownerAddress][otherAssetAddress] ?? 0,
                  }
                }
                if (assetChange.direction === 'OUT') {
                  // if stablecoin goes out, it's a buy
                  const swapInfo = {
                    type: 'buy',
                    inputToken: assetChange.asset.symbol ?? '',
                    outputToken: otherAssetChange.asset.symbol ?? '',
                    txHash: details.hash,
                    quantity: Number(otherAssetChange.quantity),
                    USDValue: assetChange.transactedValue?.value ?? 0,
                  } as const
                  buySells[otherAssetAddress].buys.push(swapInfo)
                } else {
                  const swapInfo = {
                    type: 'sell',
                    inputToken: otherAssetChange.asset.symbol ?? '',
                    outputToken: assetChange.asset.symbol ?? '',
                    txHash: details.hash,
                    quantity: Number(otherAssetChange.quantity),
                    USDValue: assetChange.transactedValue?.value ?? 0,
                  } as const
                  buySells[otherAssetAddress].sells.push(swapInfo)
                }
                continue
              }
            }
          }
        }
      }
    }
    map[portfolio.ownerAddress] = buySells
  })
  return { judgementalActivityMap: map, normalActivityMap }
}