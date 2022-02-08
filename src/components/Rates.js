import React, { Component } from 'react';
import { createClient } from 'urql'
import { clients, rewardTokens, tokenList } from '../App.js'
import { get_token_price_in_eth, formatAsPercent } from '../helpers.js'
import '../App.css';
const RAY = 10**27
const WEI_DECIMALS = 10**18 // All emissions are in wei units, 18 decimal places
const REWARD_DECIMALS = 10**18 // All rewards have 18 decimal places (eth, matic, avax)
const SECONDS_PER_YEAR = 31536000

const query = `
query {
  reserves (where: {}) {
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

class Rates extends Component {
  constructor(props) {
    super(props);
    this.state = {rates: {}, network: this.props.network};
    this.stateChanger = this.props.stateChanger;
    this.updateRates();
}

  componentDidUpdate(prevProps) {
    // Typical usage (don't forget to compare props):
    if (this.props.network !== prevProps.network) {
      this.state.network = this.props.network
      this.updateRates()
    }
  }

  async updateRates() {

    /////////////////////////////////////////
    // get aave rates data from thegraph.
    // only care about rates the user has balances for
    /////////////////////////////////////////
    console.log('update rates')
    // let client = createClient({
    //   url: APIURLS[this.network]
    // })
    let client = clients[this.state.network]
    let _token_list = tokenList[this.state.network]
    console.log(client)
    const response = await client.query(query).toPromise();
    let _rates = {}
    let reward_token_ticker = rewardTokens[this.state.network]
    const REWARD_PRICE_ETH = await get_token_price_in_eth(reward_token_ticker.replace('W',''))
    for (var i=0; i < response.data.reserves.length; i++) {
        let token = response.data.reserves[i]
        let symbol = token['symbol'].replace('W','').replace('.e','')
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
        let depositAPY = ((1 + (depositAPR / SECONDS_PER_YEAR)) ** SECONDS_PER_YEAR) - 1
        let variableBorrowAPY = ((1 + (variableBorrowAPR / SECONDS_PER_YEAR)) ** SECONDS_PER_YEAR) - 1
        
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

        let incentiveDepositAPY = ((1 + (incentiveDepositAPR / 365)) ** 365) - 1
        let incentiveBorrowAPY = ((1 + (incentiveBorrowAPR / 365)) ** 365) - 1

        _rates[symbol] =  {'deposit': {'native': depositAPY }, 'borrow': {'native': variableBorrowAPY }}
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
    console.log('rates',_rates)
    // setRates(_rates)
    this.state.rates = _rates;
    this.stateChanger(_rates)
  }

  render() {
    return (
      <div className="Rates">
        <h3>Current Rates</h3>
        <table className="table">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Deposit APY</th>
                <th scope="col">Deposit Rewards APR</th>
                <th scope="col">Borrow APY</th>
                <th scope="col">Borrow Rewards APR</th>
              </tr>
            </thead>
            <tbody>
        {
          Object.entries(this.state.rates).map(([symbol, data]) =>
            <tr>
              <th scope="row">{symbol}</th>
              <td>{formatAsPercent(data.deposit.native)}</td>
              <td>{formatAsPercent(data.deposit.rewards)}</td>
              <td>{formatAsPercent(data.borrow.native)}</td>
              <td>{formatAsPercent(data.borrow.rewards)}</td>
            </tr>
          )
        }
          </tbody>
        </table>
      </div>
    );
  }
}

export default Rates;
