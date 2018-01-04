// Copyright 2017, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

process.env.DEBUG = 'actions-on-google:*';
const { DialogflowApp } = require('actions-on-google');
const functions = require('firebase-functions');

// Dialogflow Actions
const TRANSACTION_CHECK_NO_PAYMENT = 'transaction.check.no.payment';
const TRANSACTION_CHECK_ACTION_PAYMENT = 'transaction.check.action';
const TRANSACTION_CHECK_GOOGLE_PAYMENT = 'transaction.check.google';
const TRANSACTION_CHECK_COMPLETE = 'transaction.check.complete';
const DELIVERY_ADDRESS = 'delivery.address';
const DELIVERY_ADDRESS_COMPLETE = 'delivery.address.complete';
const TRANSACTION_DECISION_ACTION_PAYMENT = 'transaction.decision.action';
const TRANSACTION_DECISION_COMPLETE = 'transaction.decision.complete';

const BALANCE_AMOUNT_CHECK = 'account.balance.check';
const TRANSFER_MONEY = 'transfer.money';

const MILLISECONDS_TO_SECONDS_QUOTIENT = 1000;

var balance_savings = 20.21;
var balance_checking = 101.22;
var balance_creditcard = 33.42;

exports.transactions = functions.https.onRequest((request, response) => {
  const app = new DialogflowApp({ request, response });
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

	function transferMoney (app) {
		console.log(request.body.result.contexts[0].parameters);
		let amount = request.body.result.contexts.find(function (el) {
			return (el.name == 'transfer' && el.parameters.amount)
		}).parameters.amount.amount;
		let accountTo = request.body.result.contexts.find(function (el) {
			return (el.name == 'transfer' && el.parameters['account-to'])
		}).parameters['account-to'];
		let accountFrom = request.body.result.contexts.find(function (el) {
			return (el.name == 'transfer' && el.parameters['account-from'][0])
		}).parameters['account-from'][0];
		var balanceEnough = true;
		switch (accountFrom) {
			case 'savings account':
				if (balance_savings < amount) {
					balanceEnough = false;
				} else {
					balance_savings = balance_savings - amount;
				}
				break;
			case 'checking account':
				if (balance_checking < amount) {
					balanceEnough = false;
				} else {
					balance_checking = balance_checking - amount;
				}
				break;
			case 'credit card account':
				if (balance_creditcard < amount) {
					balanceEnough = false;
				} else {
					balance_creditcard = balance_creditcard - amount;
				}
				break;
		}
		if (!balanceEnough) {
			app.ask('You don\' have enough balance in your ' + accountFrom);
		} else {
			switch (accountTo) {
				case 'savings account':
					balance_savings = balance_savings + amount;
					break;
				case 'checking account':
					balance_checking = balance_checking + amount;
					break;
				case 'credit card account':
					balance_creditcard = balance_creditcard + amount;
					break;
			}
			var date = Date.now().toString();
			app.ask('Okay, I have processed your transfer. Your confirmation number is: B' + date.substr(date.length - 9));
		}
	}

	function balanceAmountCheck (app) {
		let amount = 0;
		let account = request.body.result.contexts.find(function(el){
			return (el.name == 'actions_capability_screen_output' && el.parameters.account)
		}).parameters.account;
		switch (account) {
			case 'savings account':
				amount = balance_savings;
				break;
			case 'chequing account':
			case 'checking account':
				amount = balance_checking;
				break;
			case 'credit card account':
				amount = balance_creditcard;
				break;
		}
		app.ask('Your balance is $' + amount);
	}

  function transactionCheckNoPayment (app) {
		app.askForTransactionRequirements();
  }

  function transactionCheckActionPayment (app) {
    app.askForTransactionRequirements({
      type: app.Transactions.PaymentType.PAYMENT_CARD,
      displayName: 'VISA-1234',
      deliveryAddressRequired: false
    });
  }

  function transactionCheckGooglePayment (app) {
    app.askForTransactionRequirements({
      // These will be provided by payment processor, like Stripe, Braintree, or
      // Vantiv
      tokenizationParameters: {},
      cardNetworks: [
        app.Transactions.CardNetwork.VISA,
        app.Transactions.CardNetwork.AMEX
      ],
      prepaidCardDisallowed: false,
      deliveryAddressRequired: false
    });
  }

  function transactionCheckComplete (app) {
    if (app.getTransactionRequirementsResult() === app.Transactions.ResultType.OK) {
      // Normally take the user through cart building flow
      app.ask('Looks like you\'re good to go! Try saying "Get Delivery Address".');
    } else {
      app.tell('Transaction failed.');
    }
  }

  function deliveryAddress (app) {
    app.askForDeliveryAddress('To know where to send the order');
  }

  function deliveryAddressComplete (app) {
    if (app.getDeliveryAddress()) {
      console.log('DELIVERY ADDRESS: ' +
        app.getDeliveryAddress().postalAddress.addressLines[0]);
      app.data.deliveryAddress = app.getDeliveryAddress();
      app.ask('Great, got your address! Now say "confirm transaction".');
    } else {
      app.tell('Transaction failed.');
    }
  }

  function transactionDecision (app) {
    const order = app.buildOrder('<UNIQUE_ORDER_ID>')
      .setCart(app.buildCart().setMerchant('book_store_1', 'Book Store')
        .addLineItems([
          app.buildLineItem('memoirs_1', 'My Memoirs')
            .setPrice(app.Transactions.PriceType.ACTUAL, 'USD', 3, 990000000)
            .setQuantity(1)
            .addSublines('Note from the author')
            .setType(app.Transactions.LineItemType.REGULAR),
          app.buildLineItem('memoirs_2', 'Memoirs of a person')
            .setPrice(app.Transactions.PriceType.ACTUAL, 'USD', 5, 990000000)
            .setQuantity(1)
            .addSublines('Special introduction by author')
            .setType(app.Transactions.LineItemType.REGULAR),
          app.buildLineItem('memoirs_3', 'Their memoirs')
            .setPrice(app.Transactions.PriceType.ACTUAL, 'USD', 15, 750000000)
            .setQuantity(1)
            .setType(app.Transactions.LineItemType.REGULAR)
            .addSublines(
              app.buildLineItem('memoirs_epilogue', 'Special memoir epilogue')
                .setPrice(app.Transactions.PriceType.ACTUAL, 'USD', 3, 990000000)
                .setQuantity(1)
                .setType(app.Transactions.LineItemType.REGULAR)
            ),
          app.buildLineItem('memoirs_4', 'Our memoirs')
            .setPrice(app.Transactions.PriceType.ACTUAL, 'USD', 6, 490000000)
            .setQuantity(1)
            .setType(app.Transactions.LineItemType.REGULAR)
        ]).setNotes('The Memoir collection'))
      .addOtherItems([
        app.buildLineItem('subtotal', 'Subtotal')
          .setType(app.Transactions.LineItemType.SUBTOTAL)
          .setPrice(app.Transactions.PriceType.ESTIMATE, 'USD', 36, 210000000),
        app.buildLineItem('tax', 'Tax')
          .setType(app.Transactions.LineItemType.TAX)
          .setPrice(app.Transactions.PriceType.ESTIMATE, 'USD', 2, 780000000)
      ])
      .setTotalPrice(app.Transactions.PriceType.ESTIMATE, 'USD', 38, 990000000);

    if (app.data.deliveryAddress) {
      order.addLocation(app.Transactions.OrderLocationType.DELIVERY, app.data.deliveryAddress);
    }

    // To test payment w/ sample, uncheck the 'Testing in Sandbox Mode' box in the
    // Actions console simulator
    app.askForTransactionDecision(order, {
      type: app.Transactions.PaymentType.PAYMENT_CARD,
      displayName: 'VISA-1234',
      deliveryAddressRequired: true
    });

    /*
      // If using Google provided payment instrument instead
      app.askForTransactionDecision(order, {
        // These will be provided by payment processor, like Stripe,
        // Braintree, or Vantiv
        tokenizationParameters: {},
        cardNetworks: [
          app.Transactions.CardNetwork.VISA,
          app.Transactions.CardNetwork.AMEX
        ],
        prepaidCardDisallowed: false,
        deliveryAddressRequired: false
      });
    */
  }

  function transactionDecisionComplete (app) {
    if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
        app.Transactions.TransactionUserDecision.ACCEPTED) {
      const finalOrderId = app.getTransactionDecision().order.finalOrder.id;

      // Confirm order and make any charges in order processing backend
      // If using Google provided payment instrument:
      // const paymentDisplayName = app.getTransactionDecision().order.paymentInfo.displayName;

      app.tell(app.buildRichResponse().addOrderUpdate(
        app.buildOrderUpdate(finalOrderId, false)
          .setOrderState(app.Transactions.OrderState.CREATED, 'Order created')
          .setUpdateTime(Math.floor(Date.now() / MILLISECONDS_TO_SECONDS_QUOTIENT))
          .setInfo(app.Transactions.OrderStateInfo.RECEIPT, {
            confirmedActionOrderId: '<UNIQUE_ORDER_ID>'
          })
          // Replace the URL with your own customer service page
          .addOrderManagementAction(app.Transactions.ActionType.CUSTOMER_SERVICE,
            'Customer Service', 'http://example.com/customer-service'))
        .addSimpleResponse('Transaction completed! You\'re all set!'));
    } else if (app.getTransactionDecision() &&
      app.getTransactionDecision().userDecision ===
        app.Transactions.ConfirmationDecision.DELIVERY_ADDRESS_UPDATED) {
      return deliveryAddress(app);
    } else {
      app.tell('Transaction failed.');
    }
  }

  const actionMap = new Map();
  actionMap.set(TRANSACTION_CHECK_NO_PAYMENT, transactionCheckNoPayment);
  actionMap.set(TRANSACTION_CHECK_ACTION_PAYMENT, transactionCheckActionPayment);
  actionMap.set(TRANSACTION_CHECK_GOOGLE_PAYMENT, transactionCheckGooglePayment);
  actionMap.set(TRANSACTION_CHECK_COMPLETE, transactionCheckComplete);
  actionMap.set(DELIVERY_ADDRESS, deliveryAddress);
  actionMap.set(DELIVERY_ADDRESS_COMPLETE, deliveryAddressComplete);
  actionMap.set(TRANSACTION_DECISION_ACTION_PAYMENT, transactionDecision);
  actionMap.set(TRANSACTION_DECISION_COMPLETE, transactionDecisionComplete);
	actionMap.set(BALANCE_AMOUNT_CHECK, balanceAmountCheck);
	actionMap.set(TRANSFER_MONEY, transferMoney);

  app.handleRequest(actionMap);
});
