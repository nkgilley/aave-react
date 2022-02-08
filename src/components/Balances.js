import React, { Component } from 'react';
import { clients, rewardTokens, tokenList} from '../App.js'
import { formatAsUSD, get_token_price_in_usd } from '../helpers.js'
import '../App.css';
const WEI_DECIMALS = 10**18 // All emissions are in wei units, 18 decimal places

class Balances extends Component {
  constructor(props) {
    super(props);
    this.state = {subtotals: [], network: this.props.network, address: this.props.address};
    this.stateChanger = this.props.stateChanger;
    this.updateBalances();
}

  componentDidUpdate(prevProps) {
    if ((this.props.network !== prevProps.network) || (this.props.address !== prevProps.address)) {
      this.state.network = this.props.network
      this.state.address = this.props.address
      this.updateBalances()
    }
  }

  async updateBalances() {

    /////////////////////////////////////////
    // get aave user balances from thegraph.
    // only care about rates the user has balances for
    /////////////////////////////////////////
    console.log('update rates')
    // let client = createClient({
    //   url: APIURLS[this.network]
    // })
    let client = clients[this.state.network]
    let _token_list = tokenList[this.state.network]
    console.log(client)
    let reward_token_ticker = rewardTokens[this.state.network]
    let user_query = `
    {
      userReserves(where: { user: "${this.state.address}"}) {
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
    const user_response = await client.query(user_query).toPromise();
    console.log('resp', user_response)
    let _subtotals = [] // {'symbol': 'WETH.e', 'debt': 0, 'deposits': 2}
    let _totals = {'deposits': 0, 'debt': 0, 'sum': 0}
    let _annual_subtotals = []
    let _annual_totals = {'native': 0, 'rewards': 0, 'sum': 0}
    for (var i=0; i < user_response.data.userReserves.length; i++) {
      let reserve = user_response.data.userReserves[i]
      let symbol = reserve.reserve.symbol
      let decimals = WEI_DECIMALS
      if (symbol.indexOf('USDC') > -1 || symbol.indexOf('USDT') > -1) decimals = 10**6
      let currentATokenBalance = parseFloat(reserve['currentATokenBalance']) / decimals
      let currentTotalDebt  = parseFloat(reserve['currentTotalDebt']) / decimals
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

      _subtotal['sum'] = _subtotal.deposits - _subtotal.debt
      if (currentATokenBalance > 0 || currentTotalDebt > 0) {
        _token_list.push(symbol)
        _subtotals.push(_subtotal)
      }
    }
    this.state.subtotals = _subtotals;
    this.stateChanger(_subtotals)
  }

  render() {
    return (
      <div className="Rates">
        <h3>User Balances (USD)</h3>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Deposits</th>
              <th scope="col">Borrows</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
        {
          this.state.subtotals.map((token, index) => (
            <tr>
              <th scope="row">{token.symbol}</th>
              <td>{formatAsUSD(token.deposits)}</td>
              <td>{formatAsUSD(token.debt)}</td>
              <td>{formatAsUSD(token.sum)}</td>
            </tr>
          ))
        }
          </tbody>
          {/* <tfoot>
          <tr>
            <th scope="row">Total</th>
            { <td className="bold">{userTotals.deposits}</td> }
            { <td className="bold">{userTotals.debt}</td> }
            { <td className="bold">{userTotals.sum}</td> }
          </tr>
          </tfoot> */}
        </table>
      </div>
    );
  }
}

export default Balances;
