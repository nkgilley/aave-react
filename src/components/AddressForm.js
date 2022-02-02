import React, { Component } from 'react';
import Web3 from 'web3';
import './AddressForm.css';

class AddressForm extends Component {
  constructor(props) {
    super(props);
    this.state = {value: this.props.address};
    this.address = this.state.value
    this.stateChanger = this.props.stateChanger;

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.connectMetamask = this.connectMetamask.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
  }

  handleSubmit(event) {
    let address = this.state.value.toLowerCase();
    if (Web3.utils.isAddress(address)) {
      this.stateChanger(address);
      this.address = address
    } else {
      alert('Invalid ethereum address: ' + address)
    }
    event.preventDefault();
  }

  async connectMetamask(event) {
    console.log('event',event)
    async function getAccount() {
      const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
      const accounts = await web3.eth.requestAccounts();
      console.log('update state', accounts[0])
      return accounts[0].toLowerCase()
    }
    let _account = await getAccount();
    console.log('mmaccount', _account)
    this.setState({value: _account});
    this.stateChanger(_account)
    this.address = _account
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <div className="row">
          <div className="col-8">
            <label for="addressInput">Address:</label>  
            <input id="addressInput" type="text" value={this.state.value} onChange={this.handleChange} />
            <input type="submit" value="Manual" className="btn btn-secondary" />
          </div>
          <div className="col-4">
            <button type="button" className="btn btn-primary float-end" onClick={this.connectMetamask}>Connect Metamask</button>
          </div>
        </div>
        {/* <p>Current Account: {this.address}</p> */}
        
      </form>
    );
  }
}

export default AddressForm;
