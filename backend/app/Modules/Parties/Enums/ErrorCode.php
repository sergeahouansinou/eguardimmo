<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case PartyNotFound = 'party_not_found';
    case ContactPointNotFound = 'contact_point_not_found';
    case IdentifierNotFound = 'identifier_not_found';
    case BankAccountNotFound = 'bank_account_not_found';
    case VersionConflict = 'party_version_conflict';
    case PartyAnonymized = 'party_anonymized';
    case ContactPointExists = 'contact_point_exists';
    case IdentifierTaken = 'identifier_taken';
    case BankAccountExists = 'bank_account_exists';
    case BankAccountClosed = 'bank_account_closed';
    case BankAccountPeriodInvalid = 'bank_account_period_invalid';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::PartyNotFound, self::ContactPointNotFound, self::IdentifierNotFound, self::BankAccountNotFound => 404,
            self::VersionConflict, self::PartyAnonymized, self::ContactPointExists, self::IdentifierTaken,
            self::BankAccountExists, self::BankAccountClosed => 409,
            self::BankAccountPeriodInvalid => 422,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::PartyNotFound => 'Contact introuvable',
            self::ContactPointNotFound => 'Coordonnée introuvable',
            self::IdentifierNotFound => 'Identifiant introuvable',
            self::BankAccountNotFound => 'Compte bancaire introuvable',
            self::VersionConflict => 'Fiche modifiée entre-temps',
            self::PartyAnonymized => 'Contact anonymisé',
            self::ContactPointExists => 'Coordonnée existante',
            self::IdentifierTaken => 'Identifiant déjà utilisé',
            self::BankAccountExists => 'Compte bancaire existant',
            self::BankAccountClosed => 'Compte bancaire clôturé',
            self::BankAccountPeriodInvalid => 'Période invalide',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::PartyNotFound => 'Ce contact n\'existe pas dans votre organisation.',
            self::ContactPointNotFound => 'Cette coordonnée n\'existe pas dans votre organisation.',
            self::IdentifierNotFound => 'Cet identifiant n\'existe pas dans votre organisation.',
            self::BankAccountNotFound => 'Ce compte bancaire n\'existe pas dans votre organisation.',
            self::VersionConflict => 'La fiche a été modifiée depuis sa lecture : rechargez-la avant de renvoyer vos changements.',
            self::PartyAnonymized => 'Un contact anonymisé ne se modifie plus.',
            self::ContactPointExists => 'Ce contact porte déjà cette coordonnée.',
            self::IdentifierTaken => 'Un contact de votre organisation porte déjà cet identifiant.',
            self::BankAccountExists => 'Ce contact a déjà ce compte bancaire en cours de validité.',
            self::BankAccountClosed => 'Ce compte bancaire est déjà clôturé.',
            self::BankAccountPeriodInvalid => 'La date de début du nouveau compte précède celle du compte remplacé.',
        };
    }
}
