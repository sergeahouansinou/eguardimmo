<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Data\RoleDomainData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\RoleAccess;

/**
 * Matrice des droits des quatre rôles de l'équipe (ADR 0040, décision 6) : elle décrit, elle n'applique rien. L'application reste aux
 * middlewares `organization:` et `two-factor` des routes et aux contrôles des contrôleurs ; `RoleMatrixTest` vérifie l'accord des deux.
 *
 * Un domaine regroupe des routes qui partagent les mêmes rôles. Lecture d'un niveau : `r` lecture, `p` lecture et préparation,
 * `w` écriture, `2` écriture avec double authentification, `-` aucun accès ; dans l'ordre owner, admin, manager, accountant.
 *
 * `messaging_external` décrit les fils avec les locataires et les mandants : la boîte interne, entre membres, reste ouverte aux quatre rôles.
 */
final class RoleMatrix
{
    private const array ROLES = [MemberRole::Owner, MemberRole::Admin, MemberRole::Manager, MemberRole::Accountant];

    /**
     * @return list<RoleDomainData>
     */
    public static function domains(): array
    {
        return [
            self::domain('team', ['organizations.*'], ['organizations.activity.*'], 'wwrr'),
            self::domain('activity_log', ['organizations.activity.index'], [], 'rrr-'),
            self::domain('activity_detail', ['organizations.activity.show'], [], 'rr--'),
            self::domain('activity_export', ['organizations.activity.export'], [], '22--'),
            self::domain('reference_data', ['catalog.*'], [], 'wwrr'),
            self::domain('mandates', ['mandates.*'], ['mandates.documents.*', 'mandates.term-defaults.*'], 'wwwr'),
            self::domain('mandate_documents', ['mandates.documents.*'], [], 'www-'),
            self::domain('mandate_defaults', ['mandates.term-defaults.*'], [], 'wwrr'),
            self::domain('parties', ['parties.index', 'parties.show', 'parties.store', 'parties.update', 'parties.archive', 'parties.restore', 'parties.import', 'parties.contact-points.*', 'parties.identifiers.*'], [], 'wwwr'),
            self::domain('parties_followup', ['parties.contact-updates.*', 'parties.tenant-access.*', 'parties.owner-access.show', 'parties.owner-access.destroy'], [], 'www-'),
            self::domain('parties_sensitive', ['parties.bank-accounts.*', 'parties.owner-access.store'], [], '222-'),
            self::domain('parties_anonymize', ['parties.anonymize'], [], 'ww--'),
            self::domain('properties', ['properties.*'], [], 'wwwr'),
            self::domain('planning', ['planning.*'], ['planning.tasks.complete', 'planning.tasks.reopen'], 'wwwr'),
            self::domain('planning_task_progress', ['planning.tasks.complete', 'planning.tasks.reopen'], [], 'wwww', code: true),
            self::domain('leases', ['leases.*'], ['leases.documents.*', 'leases.insurance*', 'leases.notice-requests.*'], 'wwwr'),
            self::domain('leases_followup', ['leases.documents.*', 'leases.insurance*', 'leases.notice-requests.*'], [], 'www-'),
            self::domain('inspections', ['inspections.*'], [], 'www-'),
            self::domain('rent_collection', ['rent.payments.index', 'rent.payments.show', 'rent.payments.store', 'rent.installments.index', 'rent.installments.show', 'rent.installments.notice.download', 'rent.leases.balance', 'rent.receipts.index', 'rent.receipts.show', 'rent.receipts.download'], [], 'wwwp'),
            self::domain('rent_operations', ['rent.installments.cancel', 'rent.installments.issue', 'rent.installments.issue-due', 'rent.installments.receipt', 'rent.leases.installments.generate', 'rent.payments.cancel', 'rent.receipts.issue-pending'], [], 'www-'),
            self::domain('rent_refunds', ['rent.leases.refunds.store'], [], '22-2'),
            self::domain('recovery', ['recovery.*'], [], 'wwwr'),
            self::domain('invoices', ['invoicing.*'], ['invoicing.invoices.credit-notes.*'], 'wwww'),
            self::domain('credit_notes', ['invoicing.invoices.credit-notes.*'], [], 'ww-w'),
            self::domain('owner_funds', ['ownerFunds.*'], self::OWNER_FUNDS_SENSITIVE, 'pppp'),
            self::domain('owner_funds_sensitive', self::OWNER_FUNDS_SENSITIVE, [], '22-2'),
            self::domain('charges', ['charges.exercises.*', 'charges.expenses.*', 'charges.keys.*', 'charges.statements.*'], [...self::CHARGES_THIRD_PARTY, ...self::CHARGES_ISSUE], 'wwww'),
            self::domain('charges_third_party', self::CHARGES_THIRD_PARTY, [], '22-2'),
            self::domain('charges_issue', self::CHARGES_ISSUE, [], 'www-'),
            self::domain('investments', ['investments.*'], self::INVESTMENTS_READ, 'ww-w'),
            self::domain('investments_read', self::INVESTMENTS_READ, [], 'rrrr'),
            self::domain('tax_read', ['tax.rentalIncome.show', 'tax.summaries.index', 'tax.summaries.show', 'tax.mandantStatements.index', 'tax.mandantStatements.show'], [], 'rrrr'),
            self::domain('tax_prepare', ['tax.summaries.store', 'tax.summaries.rectify', 'tax.mandantStatements.store', 'tax.mandantStatements.rectify'], [], 'ww-w'),
            self::domain('tax_publish', ['tax.mandantStatements.publish'], [], '222-'),
            self::domain('tax_export', ['tax.summaries.pdf', 'tax.summaries.lines', 'tax.mandantStatements.pdf', 'tax.mandantStatements.lines'], [], '22-2'),
            self::domain('banking', ['banking.*'], ['banking.accounts.*'], '22-2'),
            self::domain('banking_accounts', ['banking.accounts.*'], [], '22-r'),
            self::domain('accounting_ledger', ['accounting.accounts.*', 'accounting.entries.*', 'accounting.leases.*'], [], 'rr-r'),
            self::domain('accounting_periods', ['accounting.periods.*'], [], 'rrrr'),
            self::domain('maintenance', ['maintenance.*'], ['maintenance.invoices.*', 'maintenance.allocations.*', 'maintenance.payments.*'], 'wwwr'),
            self::domain('maintenance_invoices', ['maintenance.invoices.*'], [], 'wwww'),
            self::domain('maintenance_allocations', ['maintenance.allocations.*'], [], 'ww-w'),
            self::domain('maintenance_payments', ['maintenance.payments.*'], [], '22-2'),
            self::domain('reporting', ['reporting.*'], ['reporting.reports.publish', 'reporting.reports.rectify', 'reporting.reports.unschedule', 'reporting.reports.lines', 'reporting.forecast.assumptions', 'reporting.finance.exports'], 'wwww'),
            self::domain('reporting_publish', ['reporting.reports.publish', 'reporting.reports.rectify', 'reporting.reports.unschedule'], [], 'www-'),
            self::domain('reporting_export', ['reporting.reports.lines'], [], '22-2'),
            self::domain('reporting_assumptions', ['reporting.forecast.assumptions'], [], 'ww-w'),
            self::domain('reporting_finance_export', ['reporting.finance.exports'], [], 'rr-r'),
            self::domain('messaging_external', ['messaging.conversations.*'], ['messaging.conversations.mute', 'messaging.conversations.unmute'], 'www-', code: true),
            self::domain('messaging_moderation', ['messaging.conversations.mute', 'messaging.conversations.unmute'], [], '22--', code: true),
            self::domain('support_access', ['messaging.support_access.*'], [], '22--', code: true),
            self::domain('privacy_requests', ['privacy.org.*'], [], 'ww--', code: true),
            self::domain('campaigns', ['notifications.campaigns.*'], ['notifications.campaigns.schedule', 'notifications.campaigns.send'], 'www-', code: true),
            self::domain('campaigns_send', ['notifications.campaigns.schedule', 'notifications.campaigns.send'], [], '222-', code: true),
            self::domain('documents', ['documents.*'], [], 'wwwr'),
            self::domain('online_payments', ['payments.online-payments.*'], [], 'rrrr'),
            self::domain('psp_account', ['payments.account.*'], [], '22--'),
        ];
    }

    public static function domainOf(string $routeName): ?RoleDomainData
    {
        $trouves = array_values(array_filter(self::domains(), fn (RoleDomainData $d): bool => $d->matches($routeName)));

        return count($trouves) === 1 ? $trouves[0] : null;
    }

    private const array OWNER_FUNDS_SENSITIVE = [
        'ownerFunds.batches.cancel', 'ownerFunds.batches.export', 'ownerFunds.batches.validate', 'ownerFunds.holds.release',
        'ownerFunds.items.execute', 'ownerFunds.items.fail', 'ownerFunds.items.return', 'ownerFunds.payoutAccountRequests.approve',
        'ownerFunds.payoutAccountRequests.proof', 'ownerFunds.payoutAccountRequests.reject', 'ownerFunds.periods.close',
        'ownerFunds.trust.deposits.confirm', 'ownerFunds.trust.deposits.store', 'ownerFunds.trust.withdrawals.store',
    ];

    private const array CHARGES_THIRD_PARTY = ['charges.exercises.statements.export', 'charges.expenses.approve', 'charges.expenses.export'];

    private const array INVESTMENTS_READ = ['investments.acquisitions.index', 'investments.acquisitions.show', 'investments.loans.index', 'investments.loans.show', 'investments.loans.schedule'];

    private const array CHARGES_ISSUE = ['charges.exercises.issue', 'charges.statements.files.share', 'charges.statements.plan', 'charges.statements.rectify', 'charges.statements.retry'];

    /**
     * @param  list<string>  $routes
     * @param  list<string>  $except
     */
    private static function domain(string $key, array $routes, array $except, string $niveaux, bool $code = false): RoleDomainData
    {
        $levels = [];

        foreach (self::ROLES as $i => $role) {
            $levels[$role->value] = match ($niveaux[$i]) {
                'r' => RoleAccess::Read,
                'p' => RoleAccess::Prepare,
                'w' => RoleAccess::Write,
                '2' => RoleAccess::WriteTwoFactor,
                default => RoleAccess::None,
            };
        }

        return new RoleDomainData($key, $routes, $except, $levels, $code);
    }
}
