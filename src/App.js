import './App.css';
import AddressForm from './components/AddressForm'
import NetworkSelect from './components/NetworkSelect'
import { createClient } from 'urql'
import { useEffect, useState } from 'react'

const US_LOCALE = Intl.NumberFormat('en-US', {
  style: "currency",
  currency: "USD"
});

const APIURLS = {'avax':'https://api.thegraph.com/subgraphs/name/aave/protocol-v2-avalanche',
                  'matic': 'https://api.thegraph.com/subgraphs/name/aave/aave-v2-matic',
                  'eth': 'https://api.thegraph.com/subgraphs/name/aave/protocol-v2'}
const query = `
query {
  reserves (where: {
    usageAsCollateralEnabled: true
  }) {
    id
    name
    price {
      id
      priceInEth
    }
    liquidityRate
    variableBorrowRate
    stableBorrowRate
    aEmissionPerSecond
    vEmissionPerSecond
    decimals
    totalATokenSupply
    totalCurrentVariableDebt
    symbol
  }
}
`

// keep a dict of token prices to avoid too many api calls to binance
let token_prices = {}

async function get_token_price_in_usd(ticker) {
  ticker = ticker.replace('.e','').replace('W','')
  if (ticker in token_prices) {
  } else {
    if (ticker !== 'USDT') {
      if (ticker !== 'XSUSHI') {
        token_prices[ticker] = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${ticker}USDT`)
          .then(response => response.json())
          .catch(error => -1)
          .then(data => {
            if (data.hasOwnProperty("price")) return parseFloat(data.price)
            console.log('fetched from binance: ', ticker, token_prices[ticker])
            return -1
          })
      } else { //xsushi
        token_prices[ticker] = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ticker}&vs_currencies=usd`)
        .then(response => response.json())
        .catch(error => -1)
        .then(data => {
          if (data.hasOwnProperty(ticker.toLowerCase())) return parseFloat(data[ticker.toLowerCase()]['usd'])
          console.log('fetched from coingecko: ', ticker, token_prices[ticker])
          return -1
        })
      }
    } else {
      return 1.0
    }
  }
  return token_prices[ticker]
}

async function get_token_price_in_eth(ticker) {
  let token_in_usdt = await get_token_price_in_usd(ticker)
  let eth_in_usdt = await get_token_price_in_usd('ETH')
  console.log('eth price of ', ticker, eth_in_usdt)
  return token_in_usdt / eth_in_usdt
}

const avaxClient = createClient({
  url: APIURLS['avax']
})
const ethClient = createClient({
  url: APIURLS['eth']
})
const maticClient = createClient({
  url: APIURLS['matic']
})
const clients = {'matic': maticClient, 'avax': avaxClient, 'eth': ethClient}
const rewardTokens = {'matic': 'WMATIC', 'avax': 'WAVAX', 'eth': 'WETH'}

function App() {
  
  const RAY = 10**27
  const WEI_DECIMALS = 10**18 // All emissions are in wei units, 18 decimal places
  const REWARD_DECIMALS = 10**18 // All rewards have 18 decimal places (eth, matic, avax)
  const SECONDS_PER_YEAR = 31536000

  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('avax')
  const [rates, setRates] = useState({})
  const [userReserves, setUserReserves] = useState([])
  const [userSubtotals, setUserSubtotals] = useState([])
  const [userTotals, setUserTotals] = useState({})
  const [annualSubtotals, setAnnualSubtotals] = useState([])
  const [annualTotals, setAnnualTotals] = useState({})

  useEffect(() => {
    fetchData()
  }, [address, network]) // only rerun if address changes

  async function fetchData() {
    if (!address || address.length == 0) return
    // clear data
    setUserReserves([])
    setUserSubtotals([])
    setUserTotals({})
    setRates({})
    setAnnualSubtotals([])
    setAnnualTotals({})

    ///////////////////////////////////
    // Get user specific data
    //////////////////////////////////
    const user_query = `
    {
      userReserves(where: { user: "${address}"}) {
        id
        reserve{
          id
          symbol
        }
        currentATokenBalance
        currentTotalDebt
      }
    }
    `
    console.log('query',user_query)
    let client = clients[network]
    let reward_token_ticker = rewardTokens[network]
    const user_response = await client.query(user_query).toPromise();
    console.log('resp', user_response)
    setUserReserves(user_response.data.userReserves);

    let _subtotals = [] // {'symbol': 'WETH.e', 'debt': 0, 'deposits': 2}
    let _totals = {'deposits': 0, 'debt': 0, 'sum': 0}
    let _annual_subtotals = []
    let _annual_totals = {'native': 0, 'rewards': 0, 'sum': 0}
    let _token_list = ['ETH', "MATIC", "AVAX"]  //always get these rates
    for (var i=0; i < user_response.data.userReserves.length; i++) {
      let reserve = user_response.data.userReserves[i]
      let symbol = reserve.reserve.symbol
      let currentATokenBalance = parseFloat(reserve['currentATokenBalance']) / WEI_DECIMALS
      let currentTotalDebt  = parseFloat(reserve['currentTotalDebt']) / WEI_DECIMALS
      let _subtotal = {'symbol': symbol, 'debt': 0, 'deposits': 0}
      console.log('tally',symbol, currentATokenBalance, currentTotalDebt)
      let _usdp = await get_token_price_in_usd(symbol)
      if (_usdp === -1) {
        // token not found in binance api
        continue
      }
      if (currentATokenBalance > 0) {
        //console.log('val', val, currentATokenBalance, get_token_price_in_usd(symbol))
        _subtotal['deposits'] += currentATokenBalance * _usdp
      }
      if (currentTotalDebt > 0) {
        _subtotal['debt'] += currentTotalDebt * _usdp
      }
      _totals['deposits'] += _subtotal.deposits
      _totals['debt'] += _subtotal.debt
      _totals['sum'] += _subtotal.deposits - _subtotal.debt

      // string formatting
      _subtotal['sum'] = US_LOCALE.format(_subtotal.deposits - _subtotal.debt)
      _subtotal['deposits'] = US_LOCALE.format(_subtotal.deposits)
      _subtotal['debt'] = US_LOCALE.format(_subtotal.debt)
      if (currentATokenBalance > 0 || currentTotalDebt > 0) {
        _token_list.push(symbol)
        _subtotals.push(_subtotal)
      }
    }
    console.log('token list', _token_list)

    /////////////////////////////////////////
    // get aave rates data from thegraph.
    // only care about rates the user has balances for
    /////////////////////////////////////////
    console.log(network)
    console.log(client)
    const response = await client.query(query).toPromise();
    let _rates = {}
    const REWARD_PRICE_ETH = await get_token_price_in_eth(reward_token_ticker.replace('W',''))
    for (var i=0; i < response.data.reserves.length; i++) {
      let token = response.data.reserves[i]
      let symbol = token['symbol']
      console.log('111111',symbol, _token_list)
      if (!_token_list.includes(symbol)) continue
      let variableBorrowRate = parseFloat(token['variableBorrowRate'])
      let liquidityRate = parseFloat(token['liquidityRate'])
      let aEmissionPerSecond = parseFloat(token['aEmissionPerSecond'])
      let vEmissionPerSecond = parseFloat(token['vEmissionPerSecond'])
      let totalCurrentVariableDebt = parseFloat(token['totalCurrentVariableDebt'])
      let totalATokenSupply  = parseFloat(token['totalATokenSupply'])   
      let token_price_eth = await get_token_price_in_eth(symbol)
      let underlying_token_decimals = 10**parseFloat(token['decimals'])

      // Deposit and Borrow calculations
      // APY and APR are returned here as decimals, multiply by 100 to get the percents     
      let depositAPR = liquidityRate/RAY
      let variableBorrowAPR = variableBorrowRate/RAY
      // let depositAPY = ((1 + (depositAPR / SECONDS_PER_YEAR)) ^ SECONDS_PER_YEAR) - 1
      // let variableBorrowAPY = ((1 + (variableBorrowAPR / SECONDS_PER_YEAR)) ^ SECONDS_PER_YEAR) - 1
      
      // Incentives calculation
      let aEmissionPerYear = aEmissionPerSecond * SECONDS_PER_YEAR
      let vEmissionPerYear = vEmissionPerSecond * SECONDS_PER_YEAR

      // UNDERLYING_TOKEN_DECIMALS will be the decimals of token underlying the aToken or debtToken
      // For Example, UNDERLYING_TOKEN_DECIMALS for aUSDC will be 10**6 because USDC has 6 decimals
      console.log("======================== " + symbol + " ================================="  )
      console.log('(aEmissionPerYear * REWARD_PRICE_ETH * WEI_DECIMALS)', aEmissionPerYear, REWARD_PRICE_ETH, WEI_DECIMALS)
      console.log('(totalATokenSupply * token_price_eth * underlying_token_decimals)', totalATokenSupply , token_price_eth , underlying_token_decimals)
      console.log("======================== " + symbol + " ================================="  )


      let incentiveDepositAPR = (aEmissionPerYear * REWARD_PRICE_ETH * underlying_token_decimals)/
                                (totalATokenSupply * token_price_eth * REWARD_DECIMALS)
                                
      let incentiveBorrowAPR = (vEmissionPerYear * REWARD_PRICE_ETH * underlying_token_decimals)/
                                (totalCurrentVariableDebt * token_price_eth * REWARD_DECIMALS)

      _rates[symbol] =  {'deposit': {'native': depositAPR }, 'borrow': {'native': variableBorrowAPR }}
      // console.log('(aEmissionPerSecond * SECONDS_PER_YEAR * REWARD_PRICE_ETH * WAD) / (totalATokenSupply * token_price_eth * underlying_token_decimals)',(aEmissionPerSecond * SECONDS_PER_YEAR * REWARD_PRICE_ETH * WAD) / (totalATokenSupply * token_price_eth * underlying_token_decimals))
      // console.log('(aEmissionPerSecond * SECONDS_PER_YEAR * REWARD_PRICE_ETH * WAD) / (totalATokenSupply * token_price_eth * underlying_token_decimals)',(aEmissionPerSecond * SECONDS_PER_YEAR * REWARD_PRICE_ETH * WAD))
      // console.log('(totalATokenSupply * token_price_eth * underlying_token_decimals)',(totalATokenSupply * token_price_eth * underlying_token_decimals))
      _rates[symbol]['deposit']['rewards'] = incentiveDepositAPR
      if (totalCurrentVariableDebt > 0) {
        _rates[symbol]['borrow']['rewards'] = incentiveBorrowAPR
      } else {
        _rates[symbol]['borrow']['rewards'] = 0
      }
    }
    console.log('rate',_rates)
    setRates(_rates)
     



    // Calculate annual rewards
    for (var i=0; i < user_response.data.userReserves.length; i++) {
      let reserve = user_response.data.userReserves[i]
      let symbol = reserve.reserve.symbol
      if (!_token_list.includes(symbol) || symbol === 'USDT') continue
      console.log(symbol, _token_list)
      let currentATokenBalance = parseFloat(reserve['currentATokenBalance']) / WEI_DECIMALS
      let currentTotalDebt  = parseFloat(reserve['currentTotalDebt']) / WEI_DECIMALS
      if (currentATokenBalance === 0 && currentTotalDebt === 0) continue
      // calc native rewards
      console.log('Annual rewards for this symbol', symbol)
      let native = (currentATokenBalance * _rates[symbol]['deposit']['native']) - (currentTotalDebt * _rates[symbol]['borrow']['native'])
      let token_price = await get_token_price_in_usd(symbol)
      let native_usd = native * token_price
      console.log('nativeusd', native_usd)
      
      // calc axax rewards (incentives)
      let avax_price = await get_token_price_in_usd('AVAX')
      let deposit_rewards_usd = currentATokenBalance * token_price * _rates[symbol]['deposit']['rewards']
      let borrow_rewards_usd = currentTotalDebt * token_price * _rates[symbol]['borrow']['rewards']
      let rewards = (deposit_rewards_usd + borrow_rewards_usd) / avax_price
      console.log(symbol + ' Rewards', deposit_rewards_usd, borrow_rewards_usd)
      // if (symbol.indexOf('AVAX') === -1) {
      //   if (deposit_rewards > 0) deposit_rewards /= avax_price
      //   if (borrow_rewards > 0) borrow_rewards /= avax_price
      // }

      let rewards_usd = deposit_rewards_usd + borrow_rewards_usd
      // let rewards_usd = rewards * avax_price
      console.log('rewards',rewards_usd)

      _annual_totals['native'] += native_usd
      _annual_totals['rewards'] += rewards_usd
      _annual_totals['sum'] += native_usd + rewards_usd
      let _annual_subtotal = {'symbol': symbol,
                              'native':
                                {'USD': US_LOCALE.format(native_usd),
                                  'native': native
                                },
                              'rewards':
                                {'USD': US_LOCALE.format(rewards_usd),
                                  'WAVAX': rewards},
                              'total':
                                {'USD': US_LOCALE.format(native_usd + rewards_usd)}}

      _annual_subtotals.push(_annual_subtotal)
    }
    _totals['deposits'] = US_LOCALE.format(_totals.deposits)
    _totals['debt'] = US_LOCALE.format(_totals.debt)
    _totals['sum'] = US_LOCALE.format(_totals.sum)
    _annual_totals['native'] = US_LOCALE.format(_annual_totals.native)
    _annual_totals['rewards'] = US_LOCALE.format(_annual_totals.rewards)
    _annual_totals['sum'] = US_LOCALE.format(_annual_totals.sum)
    console.log('subtotals',_subtotals)
    console.log('totals',_totals)
    console.log('annual subtotals', _annual_subtotals)
    setUserSubtotals(_subtotals)
    setUserTotals(_totals)
    setAnnualSubtotals(_annual_subtotals)
    setAnnualTotals(_annual_totals)
  }
  return (
    <div className="App">
      <AddressForm address={address} stateChanger={setAddress}/>
      <NetworkSelect network={network} stateChanger={setNetwork}/>
      <h2>Current Rates</h2>
          <div className="container table-head">
            <div className="row align-items-start">
              <div className="col">Token</div>
              <div className="col">Deposit Rate</div>
              <div className="col">Deposit Rewards</div>
              <div className="col">Borrow Rate</div>
              <div className="col">Borrow Rewards</div>
            </div>
          </div>
      {
        Object.entries(rates).map(([symbol, data]) =>   //.map((rate, index) => (
          <div className="container">
            <div className="row align-items-start">
            <div className="col">{symbol}</div>
            <div className="col">{100*data.deposit.native}</div>
            <div className="col">{100*data.deposit.rewards}</div>
            <div className="col">{100*data.borrow.native}</div>
            <div className="col">{100*data.borrow.rewards}</div>
            </div>
          </div>
        )
      }
      {/* <br></br>
      <h2>User Balances (native)</h2>
      <div className="container">
          <div className="row align-items-start">
            <div className="col">Token</div>
            <div className="col">Deposits</div>
            <div className="col">Borrows</div>
          </div>
        </div>
        <div className="container">
          <div className="row align-items-start">
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
          </div>
        </div>
      {
        userReserves.map((reserve, index) => (
          <div className="container">
            <div className="row align-items-start">
            <div className="col">{reserve.reserve.symbol}</div>
            <div className="col">{reserve.currentATokenBalance / 10**18}</div>
            <div className="col">{reserve.currentTotalDebt / 10**18}</div>
            </div>
          </div>
        ))
      } */}
      <br></br>
      <h2>User Balances (USD)</h2>
        <div className="container">
          <div className="row align-items-start">
            <div className="col">Token</div>
            <div className="col">Deposits</div>
            <div className="col">Borrows</div>
            <div className="col">Sum</div>
          </div>
        </div>
        <div className="container">
          <div className="row align-items-start">
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
          </div>
        </div>
        {
          userSubtotals.map((token, index) => (
            
            <div className="container">
              <div className="row align-items-start">
              <div className="col">{token.symbol}</div>
              <div className="col">{token.deposits}</div>
              <div className="col">{token.debt}</div>
              <div className="col">{token.sum}</div>
              </div>
            </div>

          ))
        }
        <div className="container">
          <div className="row align-items-start">
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
          </div>
        </div>

        <div className="container">
          <div className="row align-items-start">
            <div className="col"/>
              { <div className="col">{userTotals.deposits}</div> }
              { <div className="col">{userTotals.debt}</div> }
              {  <div className="col">{userTotals.sum}</div> }
            </div>
        </div>

        <br></br>
        <h2>Annual Rewards (current rates extrapolated)</h2>
        <div className="container">
          <div className="row align-items-start">
            <div className="col">Token</div>
            <div className="col">Native Rewards</div>
            <div className="col">Incentives</div>
            <div className="col">Sum</div>
          </div>
        </div>
        <div className="container">
          <div className="row align-items-start">
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
          </div>
        </div>
        {
          annualSubtotals.map((item, index) => (
            <div className="container">
              <div className="row align-items-start">
              <div className="col">{item.symbol}</div>
              <div className="col">{item.native.USD}</div>
              <div className="col">{item.rewards.USD}</div>
              <div className="col">{item.total.USD}</div>
              </div>
            </div>
          ))
        }
        <div className="container">
          <div className="row align-items-start">
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
            <div className="col">============</div>
          </div>
        </div>
        <div className="container">
          <div className="row align-items-start">
            <div className="col"/>
              { <div className="col">{annualTotals.native}</div> }
              { <div className="col">{annualTotals.rewards}</div> }
              {  <div className="col">{annualTotals.sum}</div> }
            </div>
        </div>

    </div>
  );
}

export default App;
