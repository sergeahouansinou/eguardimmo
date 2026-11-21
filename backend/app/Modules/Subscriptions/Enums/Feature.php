<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Enums;

/**
 * Registre des droits d'un plan : fonctions (activées ou non) et quotas (limite chiffrée, nulle pour illimité). Les fonctions du socle
 * sont obligatoires dans toute version publiée.
 */
enum Feature: string
{
    case Properties = 'properties';
    case Tenants = 'tenants';
    case Leases = 'leases';
    case Inspections = 'inspections';
    case Storage = 'storage_mb';
    case Users = 'users';
    case Signatures = 'signatures_monthly';
    case Rent = 'rent';
    case Documents = 'documents';
    case Mandates = 'mandates';
    case OwnerFunds = 'owner_funds';
    case Charges = 'charges';
    case Banking = 'banking';
    case Invoicing = 'invoicing';
    case Maintenance = 'maintenance';
    case Recovery = 'recovery';
    case Messaging = 'messaging';
    case Campaigns = 'campaigns';
    case Reporting = 'reporting';

    public function group(): string
    {
        return match ($this) {
            self::Properties, self::Tenants, self::Leases, self::Inspections, self::Storage, self::Users, self::Signatures, self::Rent, self::Documents => 'socle',
            self::Mandates, self::OwnerFunds, self::Charges, self::Banking, self::Invoicing => 'gestion',
            self::Maintenance, self::Recovery, self::Messaging, self::Campaigns => 'suivi',
            self::Reporting => 'pilotage',
        };
    }

    public function isQuota(): bool
    {
        return in_array($this, [self::Properties, self::Tenants, self::Leases, self::Inspections, self::Storage, self::Users, self::Signatures], true);
    }

    public function unit(): int
    {
        return $this === self::Storage ? 1024 * 1024 : 1;
    }

    public function label(): string
    {
        return match ($this) {
            self::Properties => 'Lots',
            self::Tenants => 'Locataires',
            self::Leases => 'Baux',
            self::Inspections => 'États des lieux',
            self::Storage => 'Stockage (Mo)',
            self::Users => 'Utilisateurs',
            self::Signatures => 'Signatures par mois',
            self::Rent => 'Loyers',
            self::Documents => 'Documents',
            self::Mandates => 'Mandats',
            self::OwnerFunds => 'Fonds des mandants',
            self::Charges => 'Charges',
            self::Banking => 'Rapprochement bancaire',
            self::Invoicing => 'Factures',
            self::Maintenance => 'Interventions',
            self::Recovery => 'Recouvrement',
            self::Messaging => 'Messagerie',
            self::Campaigns => 'Diffusions',
            self::Reporting => 'Comptes rendus',
        };
    }

    /**
     * @return list<self>
     */
    public static function core(): array
    {
        return array_values(array_filter(self::cases(), fn (self $f): bool => $f->group() === 'socle'));
    }
}
