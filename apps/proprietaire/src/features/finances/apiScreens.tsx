"use client";

import {
  BankingAccountsPage,
  BankingImportPage,
  BankingLinesPage,
  BankingReconciliationDetailPage,
  BankingReconciliationsPage,
  BankingStatementDetailPage,
  BankingStatementsPage,
  ChargesExerciseDetailPage,
  ChargesExerciseFormPage,
  ChargesExercisesPage,
  ChargesExpenseDetailPage,
  ChargesExpenseFormPage,
  ChargesExpensesPage,
  ChargesKeysPage,
  ChargesStatementPage,
  AcquisitionsPage,
  LoanDetailPage,
  LoansPage,
  TaxDetailPage,
  TaxPage,
} from "@eguardimmo/gestion";
import { bindLot } from "@/features/locataires/LotBridge";

export const DepensesApiScreen = bindLot(ChargesExpensesPage);
export const DepenseFormApiScreen = bindLot(ChargesExpenseFormPage);
export const DepenseDetailApiScreen = bindLot(ChargesExpenseDetailPage);
export const ChargesExercicesApiScreen = bindLot(ChargesExercisesPage);
export const ChargesExerciceFormApiScreen = bindLot(ChargesExerciseFormPage);
export const ChargesExerciceDetailApiScreen = bindLot(ChargesExerciseDetailPage);
export const ChargesDecompteApiScreen = bindLot(ChargesStatementPage);
export const ChargesClesApiScreen = bindLot(ChargesKeysPage);

export const BanquePointageApiScreen = bindLot(BankingLinesPage);
export const BanqueComptesApiScreen = bindLot(BankingAccountsPage);
export const BanqueRelevesApiScreen = bindLot(BankingStatementsPage);
export const BanqueReleveDetailApiScreen = bindLot(BankingStatementDetailPage);
export const BanqueImportApiScreen = bindLot(BankingImportPage);
export const BanqueEtatsApiScreen = bindLot(BankingReconciliationsPage);
export const BanqueEtatDetailApiScreen = bindLot(BankingReconciliationDetailPage);

export const PretsApiScreen = bindLot(LoansPage);
export const PretDetailApiScreen = bindLot(LoanDetailPage);
export const CoutDeRevientApiScreen = bindLot(AcquisitionsPage);
export const FiscaliteApiScreen = bindLot(TaxPage);
export const FiscaliteDetailApiScreen = bindLot(TaxDetailPage);
