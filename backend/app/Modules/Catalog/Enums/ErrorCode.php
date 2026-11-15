<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case TermNotFound = 'term_not_found';
    case TermKeyTaken = 'term_key_taken';
    case VocabularyClosed = 'vocabulary_closed';
    case PlatformTermImmutable = 'platform_term_immutable';
    case TermNotPlatform = 'term_not_platform';
    case CustomFieldNotFound = 'custom_field_not_found';
    case CustomFieldKeyTaken = 'custom_field_key_taken';
    case CustomFieldTypeLocked = 'custom_field_type_locked';
    case CustomFieldLimitReached = 'custom_field_limit_reached';
    case TagNotFound = 'tag_not_found';
    case TagNameTaken = 'tag_name_taken';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::TermNotFound, self::CustomFieldNotFound, self::TagNotFound => 404,
            self::TermKeyTaken, self::VocabularyClosed, self::PlatformTermImmutable, self::TermNotPlatform,
            self::CustomFieldKeyTaken, self::CustomFieldTypeLocked, self::CustomFieldLimitReached, self::TagNameTaken => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::TermNotFound => 'Valeur introuvable',
            self::TermKeyTaken => 'Clé déjà utilisée',
            self::VocabularyClosed => 'Référentiel fermé',
            self::PlatformTermImmutable => 'Valeur de la plateforme',
            self::TermNotPlatform => 'Valeur de l\'organisation',
            self::CustomFieldNotFound => 'Champ introuvable',
            self::CustomFieldKeyTaken => 'Clé de champ déjà utilisée',
            self::CustomFieldTypeLocked => 'Type de champ figé',
            self::CustomFieldLimitReached => 'Trop de champs',
            self::TagNotFound => 'Étiquette introuvable',
            self::TagNameTaken => 'Étiquette existante',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::TermNotFound => 'Cette valeur n\'existe pas, n\'appartient pas à ce référentiel ou n\'est pas disponible pour votre organisation.',
            self::TermKeyTaken => 'Une valeur de ce référentiel porte déjà cette clé.',
            self::VocabularyClosed => 'Ce référentiel n\'accepte pas de valeur propre à l\'organisation.',
            self::PlatformTermImmutable => 'Une valeur de la plateforme ne se modifie pas : renommez-la, masquez-la ou réordonnez-la par une surcharge.',
            self::TermNotPlatform => 'Une surcharge ne s\'applique qu\'à une valeur de la plateforme.',
            self::CustomFieldNotFound => 'Ce champ personnalisé n\'existe pas dans votre organisation.',
            self::CustomFieldKeyTaken => 'Un champ de cet objet porte déjà cette clé.',
            self::CustomFieldTypeLocked => 'Le type d\'un champ ne change plus dès qu\'une valeur existe, et ses options ne peuvent qu\'être complétées.',
            self::CustomFieldLimitReached => 'Le nombre maximal de champs personnalisés pour cet objet est atteint.',
            self::TagNotFound => 'Cette étiquette n\'existe pas dans votre organisation.',
            self::TagNameTaken => 'Une étiquette porte déjà ce nom.',
        };
    }
}
