<?php

declare(strict_types=1);

namespace App\Modules\Properties\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case PropertyNotFound = 'property_not_found';
    case UnitNotFound = 'unit_not_found';
    case OwnershipNotFound = 'ownership_not_found';
    case PropertyVersionConflict = 'property_version_conflict';
    case UnitVersionConflict = 'unit_version_conflict';
    case PropertyArchived = 'property_archived';
    case PropertyHasActiveUnits = 'property_has_active_units';
    case UnitArchived = 'unit_archived';
    case UnitHasActiveAnnexes = 'unit_has_active_annexes';
    case HouseSingleUnit = 'house_single_unit';
    case UnitReferenceTaken = 'unit_reference_taken';
    case UnitParentOtherProperty = 'unit_parent_other_property';
    case UnitParentCycle = 'unit_parent_cycle';
    case OwnershipShareExceeded = 'ownership_share_exceeded';
    case OwnershipOverlap = 'ownership_overlap';
    case OwnershipClosed = 'ownership_closed';
    case OwnershipPeriodInvalid = 'ownership_period_invalid';
    case OwnerAnonymized = 'owner_anonymized';
    case PropertyContactNotFound = 'property_contact_not_found';
    case PropertyContactExists = 'property_contact_exists';
    case ContactAnonymized = 'property_contact_party_anonymized';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::PropertyNotFound, self::UnitNotFound, self::OwnershipNotFound, self::PropertyContactNotFound => 404,
            self::UnitParentOtherProperty, self::UnitParentCycle, self::OwnershipPeriodInvalid => 422,
            default => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::PropertyNotFound => 'Site introuvable',
            self::UnitNotFound => 'Lot introuvable',
            self::OwnershipNotFound => 'Propriété introuvable',
            self::PropertyVersionConflict => 'Site modifié entre-temps',
            self::UnitVersionConflict => 'Lot modifié entre-temps',
            self::PropertyArchived => 'Site archivé',
            self::PropertyHasActiveUnits => 'Site avec des lots actifs',
            self::UnitArchived => 'Lot archivé',
            self::UnitHasActiveAnnexes => 'Lot avec des annexes actives',
            self::HouseSingleUnit => 'Maison à un seul lot',
            self::UnitReferenceTaken => 'Référence déjà utilisée',
            self::UnitParentOtherProperty => 'Annexe d\'un autre site',
            self::UnitParentCycle => 'Rattachement circulaire',
            self::OwnershipShareExceeded => 'Quotes-parts dépassées',
            self::OwnershipOverlap => 'Propriétaire déjà déclaré',
            self::OwnershipClosed => 'Propriété déjà terminée',
            self::OwnershipPeriodInvalid => 'Période invalide',
            self::OwnerAnonymized => 'Contact anonymisé',
            self::PropertyContactNotFound => 'Lien de contact introuvable',
            self::PropertyContactExists => 'Contact déjà rattaché',
            self::ContactAnonymized => 'Contact anonymisé',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::PropertyNotFound => 'Ce site n\'existe pas dans votre organisation.',
            self::UnitNotFound => 'Ce lot n\'existe pas dans votre organisation.',
            self::OwnershipNotFound => 'Cette propriété n\'existe pas pour ce lot.',
            self::PropertyVersionConflict => 'Le site a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.',
            self::UnitVersionConflict => 'Le lot a été modifié depuis sa lecture : rechargez-le avant de renvoyer vos changements.',
            self::PropertyArchived => 'Un site archivé ne reçoit plus de lot.',
            self::PropertyHasActiveUnits => 'Archivez d\'abord les lots actifs de ce site.',
            self::UnitArchived => 'Le lot de rattachement est archivé.',
            self::UnitHasActiveAnnexes => 'Archivez d\'abord les annexes actives de ce lot.',
            self::HouseSingleUnit => 'Une maison ne compte qu\'un seul lot principal actif.',
            self::UnitReferenceTaken => 'Un autre lot de ce site porte déjà cette référence.',
            self::UnitParentOtherProperty => 'Une annexe se rattache à un lot du même site.',
            self::UnitParentCycle => 'Ce rattachement ferait de ce lot sa propre annexe.',
            self::OwnershipShareExceeded => 'Sur cette période et pour cette nature de droit, les quotes-parts du lot dépasseraient 100 %.',
            self::OwnershipOverlap => 'Ce contact détient déjà ce droit sur le lot pendant tout ou partie de cette période.',
            self::OwnershipClosed => 'Cette propriété a déjà une date de fin.',
            self::OwnershipPeriodInvalid => 'La date de fin doit suivre la date de début.',
            self::OwnerAnonymized => 'Un contact anonymisé ne peut plus être déclaré propriétaire.',
            self::PropertyContactNotFound => 'Ce lien n\'existe pas pour ce site.',
            self::PropertyContactExists => 'Ce contact est déjà rattaché à ce site ou à ce lot.',
            self::ContactAnonymized => 'Un contact anonymisé ne peut plus être rattaché à un bien.',
        };
    }
}
