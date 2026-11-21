<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Enums\ActivityType;

/**
 * Catalogue des actions du journal (ADR 0038, décision 4) : type et libellé se calculent ici, jamais à l'écriture. Le premier motif qui
 * correspond fixe le type ; `*` remplace n'importe quelle suite. Une action absente du catalogue reste servie, sous un libellé générique.
 */
final class ActivityCatalog
{
    /** @var list<array{string, ActivityType}> */
    private const array TYPES = [
        ['*.export.*', ActivityType::Export],
        ['*.exported', ActivityType::Export],
        ['*.downloaded', ActivityType::Export],
        ['*.proof_downloaded', ActivityType::Export],
        ['organizations.member.*', ActivityType::Rights],
        ['organization_member.*', ActivityType::Rights],
        ['parties.owner_access.*', ActivityType::Rights],
        ['parties.tenant_access.*', ActivityType::Rights],
        ['owner_access.*', ActivityType::Rights],
        ['identity.owner_invitation.*', ActivityType::Rights],
        ['identity.tenant_invitation.*', ActivityType::Rights],
        ['messaging.support_access.*', ActivityType::Security],
        ['console.support_access.*', ActivityType::Security],
        ['organizations.organization.*', ActivityType::Security],
        ['organizations.legal_identity.*', ActivityType::Security],
        ['organization_legal_identity.*', ActivityType::Security],
        ['ownerfunds.payout_account.*', ActivityType::Security],
        ['payout_account_request.*', ActivityType::Security],
        ['bank_account.*', ActivityType::Security],
        ['party_identifier.*', ActivityType::Security],
        ['rent.payment.*', ActivityType::Payment],
        ['rent.refund.*', ActivityType::Payment],
        ['rent.card_payment.*', ActivityType::Payment],
        ['rent_payment.*', ActivityType::Payment],
        ['rent_payment_allocation.*', ActivityType::Payment],
        ['invoicing.payment.*', ActivityType::Payment],
        ['invoice_payment.*', ActivityType::Payment],
        ['maintenance.payment.*', ActivityType::Payment],
        ['supplier_payment.*', ActivityType::Payment],
        ['payments.*', ActivityType::Payment],
        ['online_payment.*', ActivityType::Payment],
        ['ownerfunds.payout.*', ActivityType::Payment],
        ['ownerfunds.batch.*', ActivityType::Payment],
        ['ownerfunds.trust.*', ActivityType::Payment],
        ['ownerfunds.hold.*', ActivityType::Payment],
        ['payout_*', ActivityType::Payment],
        ['trust_*', ActivityType::Payment],
        ['documents.*', ActivityType::Document],
        ['*.document.*', ActivityType::Document],
        ['stored_file.*', ActivityType::Document],
        ['library_document.*', ActivityType::Document],
        ['issued_document.*', ActivityType::Document],
        ['lease_document.*', ActivityType::Document],
        ['mandate_document.*', ActivityType::Document],
        ['rent.receipt.*', ActivityType::Document],
        ['rent.notice.*', ActivityType::Document],
        ['invoicing.invoice.*', ActivityType::Document],
        ['reporting.report.*', ActivityType::Document],
        ['charges.statement.*', ActivityType::Document],
        ['leases.insurance.*', ActivityType::Document],
    ];

    /** @var array<string, string> */
    private const array LABELS = [
        'organizations.activity.exported' => 'Export du journal d\'activité',
        'organizations.organization.suspended' => 'Suspension de l\'organisation',
        'organizations.organization.reactivated' => 'Réactivation de l\'organisation',
        'organizations.legal_identity.updated' => 'Mise à jour de l\'identité légale',
        'organizations.member.scope_refused' => 'Périmètre de biens refusé pour un membre',
        'organization_member.created' => 'Invitation d\'un membre',
        'organization_member.updated' => 'Modification d\'un membre de l\'équipe',
        'organization_member.deleted' => 'Retrait d\'un membre de l\'équipe',
        'organization.updated' => 'Modification des réglages de l\'organisation',
        'parties.party.anonymized' => 'Anonymisation d\'un contact',
        'parties.party.imported' => 'Import de contacts',
        'parties.duplicate.allowed' => 'Contact créé malgré un doublon possible',
        'planning.reminders.recomputed' => 'Rappels recalculés après un changement de fuseau',
        'parties.owner_access.linked' => 'Accès propriétaire rattaché',
        'parties.owner_access.unlinked' => 'Accès propriétaire retiré',
        'parties.tenant_access.linked' => 'Accès locataire rattaché',
        'parties.tenant_access.unlinked' => 'Accès locataire retiré',
        'parties.contact_update.applied' => 'Modification de coordonnées appliquée',
        'parties.contact_update.dismissed' => 'Modification de coordonnées écartée',
        'messaging.support_access.requested' => 'Accès du support demandé',
        'messaging.support_access.granted' => 'Accès du support accordé',
        'messaging.support_access.refused' => 'Accès du support refusé',
        'messaging.support_access.revoked' => 'Accès du support révoqué',
        'messaging.support_access.expired' => 'Accès du support expiré',
        'messaging.support_access.emergency' => 'Accès d\'urgence du support',
        'messaging.support_access.reviewed' => 'Accès d\'urgence du support examiné',
        'console.support_access.read' => 'Consultation par le support',
        'rent.payment.recorded' => 'Enregistrement d\'un paiement de loyer',
        'rent.payment.cancelled' => 'Annulation d\'un paiement de loyer',
        'rent.refund.recorded' => 'Remboursement enregistré',
        'rent.receipt.issued' => 'Émission d\'une quittance',
        'rent.notice.issued' => 'Émission d\'un avis d\'échéance',
        'rent.installment.cancelled' => 'Annulation d\'une échéance',
        'invoicing.invoice.issued' => 'Émission d\'une facture',
        'invoicing.invoice.credited' => 'Avoir émis sur une facture',
        'invoicing.invoice.sent' => 'Envoi d\'une facture',
        'invoicing.payment.recorded' => 'Règlement de facture enregistré',
        'invoicing.payment.cancelled' => 'Règlement de facture annulé',
        'leases.lease.signed' => 'Signature d\'un bail',
        'leases.lease.terminated' => 'Fin d\'un bail',
        'leases.lease.renewed' => 'Renouvellement d\'un bail',
        'mandates.mandate.activated' => 'Activation d\'un mandat',
        'mandates.mandate.terminated' => 'Fin d\'un mandat',
        'ownerfunds.payout.executed' => 'Reversement exécuté',
        'ownerfunds.payout.failed' => 'Reversement échoué',
        'ownerfunds.payout.returned' => 'Reversement retourné',
        'ownerfunds.batch.validated' => 'Lot de reversements validé',
        'ownerfunds.batch.exported' => 'Lot de reversements exporté',
        'ownerfunds.batch.cancelled' => 'Lot de reversements annulé',
        'ownerfunds.payout_account.requested' => 'Changement de compte de paiement demandé',
        'ownerfunds.payout_account.approved' => 'Changement de compte de paiement approuvé',
        'ownerfunds.payout_account.rejected' => 'Changement de compte de paiement rejeté',
        'ownerfunds.payout_account.contested' => 'Changement de compte de paiement contesté',
        'charges.export.generated' => 'Export de dépenses ou de décomptes',
        'charges.statement.issued' => 'Émission d\'un décompte de charges',
        'reporting.export.generated' => 'Export de comptes rendus',
        'reporting.report.published' => 'Publication d\'un compte rendu de gestion',
        'banking.statement.imported' => 'Import d\'un relevé bancaire',
        'documents.file.downloaded' => 'Téléchargement d\'un document',
        'documents.file.purged' => 'Purge d\'un document',
        'accounting.period.closed' => 'Clôture d\'une période comptable',
    ];

    /** @var array<string, string> */
    private const array SUBJECTS = [
        'organization' => 'organisation',
        'organization_member' => 'membre de l\'équipe',
        'organization_legal_identity' => 'identité légale',
        'party' => 'contact',
        'contact_point' => 'coordonnée',
        'party_identifier' => 'identifiant',
        'bank_account' => 'compte bancaire',
        'property' => 'site',
        'unit' => 'lot',
        'unit_ownership' => 'propriété',
        'lease' => 'bail',
        'lease_party' => 'partie au bail',
        'lease_unit' => 'lot du bail',
        'lease_term' => 'conditions du bail',
        'mandate' => 'mandat',
        'mandate_term' => 'conditions du mandat',
        'mandate_unit' => 'lot du mandat',
        'inspection' => 'état des lieux',
        'intervention' => 'intervention',
        'expense' => 'dépense',
        'charge_exercise' => 'exercice de charges',
        'charge_key' => 'clé de répartition',
        'invoice' => 'facture',
        'rent_payment' => 'paiement de loyer',
        'installment' => 'échéance',
        'campaign' => 'campagne',
        'tag' => 'étiquette',
        'planning_event' => 'événement d\'agenda',
        'planning_task' => 'tâche',
        'property_contact' => 'contact de bien',
    ];

    /** @var array<string, string> */
    private const array VERBS = [
        'created' => 'Création de',
        'updated' => 'Modification de',
        'deleted' => 'Suppression de',
        'restored' => 'Restauration de',
    ];

    /**
     * Clés de `metadata` servies, par action ; les valeurs doivent rester des scalaires. Une action absente de la liste ne sert aucune clé.
     *
     * @var array<string, list<string>>
     */
    private const array METADATA = [
        'organizations.activity.exported' => ['from', 'to', 'rows'],
        'parties.party.imported' => ['count'],
        'parties.duplicate.allowed' => ['matches', 'reasons'],
        'planning.reminders.recomputed' => ['tasks', 'events', 'timezone'],
        'parties.party.anonymized' => ['reason'],
        'charges.export.generated' => ['kind', 'rows'],
        'reporting.export.generated' => ['kind', 'rows'],
        'organizations.member.scope_refused' => ['scope'],
    ];

    /**
     * Préfixes d'actions jamais servis à une organisation : connexions (sans organisation, surveillance des salariés à confirmer),
     * consultations de l'activité par la console et actes internes de la plateforme.
     *
     * @var list<string>
     */
    public const array EXCLUDED = ['auth.', 'console.', 'operations.', 'identity.operator.', 'identity.account.', 'subscriptions.override.', 'subscriptions.plan_version.'];

    /**
     * Exceptions aux préfixes exclus : le support n'entre dans une organisation qu'avec son accord, et l'organisation doit le voir.
     *
     * @var list<string>
     */
    public const array EXCLUDED_EXCEPT = ['console.support_access.read'];

    /**
     * @return list<array{string, ActivityType}>
     */
    public static function typePatterns(): array
    {
        return self::TYPES;
    }

    public static function typeOf(string $action): ActivityType
    {
        foreach (self::TYPES as [$motif, $type]) {
            if (fnmatch($motif, $action)) {
                return $type;
            }
        }

        return ActivityType::Other;
    }

    public static function isServed(string $action): bool
    {
        if (in_array($action, self::EXCLUDED_EXCEPT, true)) {
            return true;
        }

        foreach (self::EXCLUDED as $prefixe) {
            if (str_starts_with($action, $prefixe)) {
                return false;
            }
        }

        return true;
    }

    public static function isSupportAction(string $action): bool
    {
        return str_starts_with($action, 'messaging.support_access.') || str_starts_with($action, 'console.support_access.');
    }

    public static function label(string $action, ?string $subjectType): string
    {
        if (isset(self::LABELS[$action])) {
            return self::LABELS[$action];
        }

        $noun = $subjectType === null ? 'élément' : (self::SUBJECTS[$subjectType] ?? str_replace('_', ' ', $subjectType));
        $verbe = self::VERBS[substr(strrchr($action, '.') ?: '.', 1)] ?? null;

        return ($verbe ?? 'Modification de').' '.$noun;
    }

    /**
     * @return list<string>
     */
    public static function metadataKeys(string $action): array
    {
        return self::METADATA[$action] ?? [];
    }
}
