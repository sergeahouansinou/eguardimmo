<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case AccountNotFound = 'bank_account_not_found';
    case AccountIdentifierInvalid = 'bank_account_identifier_invalid';
    case AccountCurrencyUnsupported = 'bank_account_currency_unsupported';
    case AccountRoleTaken = 'bank_account_role_taken';
    case AccountClosed = 'bank_account_closed';
    case AccountStartInvalid = 'bank_account_start_invalid';
    case StatementNotFound = 'bank_statement_not_found';
    case StatementFormatUnsupported = 'bank_statement_format_unsupported';
    case StatementInvalid = 'bank_statement_invalid';
    case StatementTooLarge = 'bank_statement_too_large';
    case StatementAccountMismatch = 'bank_statement_account_mismatch';
    case StatementVoidForbidden = 'bank_statement_void_forbidden';
    case StatementGap = 'bank_statement_gap';
    case LineNotFound = 'bank_line_not_found';
    case LineNotMatchable = 'bank_line_not_matchable';
    case LineStale = 'bank_line_stale';
    case MatchNotFound = 'bank_match_not_found';
    case MatchUnbalanced = 'bank_match_unbalanced';
    case MatchLocked = 'bank_match_locked';
    case IgnoreForbidden = 'bank_ignore_forbidden';
    case RuleNotFound = 'bank_rule_not_found';
    case ReconciliationNotFound = 'bank_reconciliation_not_found';
    case ReconciliationBalanceRequired = 'bank_reconciliation_balance_required';
    case ReconciliationProofRequired = 'bank_reconciliation_proof_required';
    case ReconciliationNotActionable = 'bank_reconciliation_not_actionable';
    case ReconciliationUnexplainedDifference = 'bank_reconciliation_unexplained_difference';
    case IdempotencyKeyRequired = 'banking_idempotency_key_required';
    case IdempotencyKeyReused = 'banking_idempotency_key_reused';
    case RequestConflict = 'banking_request_conflict';
    case XsdUnavailable = 'banking_xsd_unavailable';
    case CursorInvalid = 'bank_cursor_invalid';

    public function problem(?string $detail = null): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $detail ?? $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::AccountNotFound, self::StatementNotFound, self::LineNotFound, self::MatchNotFound, self::RuleNotFound, self::ReconciliationNotFound => 404,
            self::AccountIdentifierInvalid, self::AccountCurrencyUnsupported, self::AccountStartInvalid, self::StatementFormatUnsupported, self::StatementInvalid, self::StatementTooLarge,
            self::StatementAccountMismatch, self::MatchUnbalanced, self::ReconciliationBalanceRequired, self::ReconciliationProofRequired, self::IdempotencyKeyRequired => 422,
            self::CursorInvalid => 422,
            self::XsdUnavailable => 503,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::AccountNotFound => 'Compte bancaire introuvable',
            self::AccountIdentifierInvalid => 'Identifiant de compte invalide',
            self::AccountCurrencyUnsupported => 'Devise non prise en charge',
            self::AccountRoleTaken => 'Compte déjà suivi',
            self::AccountClosed => 'Compte bancaire fermé',
            self::AccountStartInvalid => 'Début de suivi invalide',
            self::StatementNotFound => 'Relevé introuvable',
            self::StatementFormatUnsupported => 'Format de relevé non pris en charge',
            self::StatementInvalid => 'Relevé invalide',
            self::StatementTooLarge => 'Relevé trop volumineux',
            self::StatementAccountMismatch => 'Relevé d\'un autre compte',
            self::StatementVoidForbidden => 'Annulation de l\'import impossible',
            self::StatementGap => 'Trou dans les relevés',
            self::LineNotFound => 'Ligne de relevé introuvable',
            self::LineNotMatchable => 'Ligne non pointable',
            self::LineStale => 'Ligne modifiée entre-temps',
            self::MatchNotFound => 'Pointage introuvable',
            self::MatchUnbalanced => 'Pointage déséquilibré',
            self::MatchLocked => 'Pointage verrouillé',
            self::IgnoreForbidden => 'Ignorer cette ligne est impossible',
            self::RuleNotFound => 'Règle introuvable',
            self::ReconciliationNotFound => 'État de rapprochement introuvable',
            self::ReconciliationBalanceRequired => 'Solde du relevé requis',
            self::ReconciliationProofRequired => 'Pièce du solde requise',
            self::ReconciliationNotActionable => 'Action impossible sur cet état',
            self::ReconciliationUnexplainedDifference => 'Écart inexpliqué',
            self::IdempotencyKeyRequired => 'Clé d\'idempotence requise',
            self::IdempotencyKeyReused => 'Clé d\'idempotence déjà utilisée',
            self::RequestConflict => 'Requête concurrente',
            self::XsdUnavailable => 'Import camt.053 indisponible',
            self::CursorInvalid => 'Curseur de pagination invalide',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::AccountNotFound => 'Ce compte bancaire n\'existe pas dans votre organisation.',
            self::AccountIdentifierInvalid => 'Cet identifiant de compte n\'est pas valide.',
            self::AccountCurrencyUnsupported => 'La devise doit être celle de l\'organisation.',
            self::AccountRoleTaken => 'Un compte est déjà suivi pour ce compte du grand livre : remplacez-le ou fermez-le.',
            self::AccountClosed => 'Ce compte bancaire est fermé.',
            self::AccountStartInvalid => 'Le suivi ne peut commencer dans le futur, ni avant celui du compte remplacé, ni après la fin du mois de sa fermeture : aucun mois ne doit rester sans compte suivi.',
            self::StatementNotFound => 'Ce relevé n\'existe pas dans votre organisation.',
            self::StatementFormatUnsupported => 'Le contenu du fichier ne correspond à aucun format pris en charge (CSV, camt.053 version 001.02 ou 001.08).',
            self::StatementInvalid => 'Le fichier n\'est pas un relevé valide.',
            self::StatementTooLarge => 'Le fichier dépasse la taille ou le nombre de lignes autorisés.',
            self::StatementAccountMismatch => 'Le compte du relevé n\'est pas celui que vous avez choisi.',
            self::StatementVoidForbidden => 'Une ligne de ce relevé est pointée ou dans un état validé : défaites d\'abord les pointages.',
            self::StatementGap => 'Un relevé manque ou ne se raccorde pas au précédent.',
            self::LineNotFound => 'Cette ligne n\'existe pas dans votre organisation.',
            self::LineNotMatchable => 'Cette ligne ou cette écriture ne peut pas être pointée (déjà pointée, ignorée, d\'un autre compte ou de sens incompatible).',
            self::LineStale => 'Cette ligne a changé depuis votre lecture : rechargez-la.',
            self::MatchNotFound => 'Ce pointage n\'existe pas dans votre organisation.',
            self::MatchUnbalanced => 'La somme des lignes de relevé doit égaler celle des lignes d\'écriture.',
            self::MatchLocked => 'Ce pointage entre dans un état de rapprochement validé.',
            self::IgnoreForbidden => 'Sur le compte de tiers, seule une paire d\'opérations de montant net nul peut être ignorée.',
            self::RuleNotFound => 'Cette règle n\'existe pas dans votre organisation.',
            self::ReconciliationNotFound => 'Cet état de rapprochement n\'existe pas dans votre organisation.',
            self::ReconciliationBalanceRequired => 'Aucun relevé ne porte de solde de clôture : saisissez le solde du relevé.',
            self::ReconciliationProofRequired => 'Un solde saisi à la main exige la pièce qui le justifie (relevé de la banque en PDF ou image).',
            self::ReconciliationNotActionable => 'Cet état n\'est pas un brouillon.',
            self::ReconciliationUnexplainedDifference => 'L\'écart inexpliqué doit être nul pour valider l\'état.',
            self::IdempotencyKeyRequired => 'L\'en-tête Idempotency-Key est obligatoire pour cette action.',
            self::IdempotencyKeyReused => 'Cette clé d\'idempotence a déjà servi pour une demande différente.',
            self::RequestConflict => 'Une requête concurrente a modifié les mêmes données : relisez l\'état puis recommencez.',
            self::XsdUnavailable => 'Les schémas officiels camt.053 ne sont pas installés sur ce serveur : importez le relevé au format CSV ou réessayez après leur installation.',
            self::CursorInvalid => 'Le curseur de pagination fourni n\'est pas valide.',
        };
    }
}
