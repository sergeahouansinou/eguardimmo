<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Journalise créations, modifications, suppressions et restaurations du modèle (ADR 0016).
 *
 * @phpstan-require-extends Model
 */
trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(fn (Model $modele) => app(RecordModelChange::class)->handle($modele, RecordModelChange::CREATED));
        static::updated(fn (Model $modele) => app(RecordModelChange::class)->handle($modele, RecordModelChange::UPDATED));
        static::deleted(fn (Model $modele) => app(RecordModelChange::class)->handle($modele, RecordModelChange::DELETED));

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::registerModelEvent('restored', fn (Model $modele) => app(RecordModelChange::class)->handle($modele, RecordModelChange::RESTORED));
        }
    }

    /**
     * Attributs jamais journalisés, en plus des horodatages.
     *
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return [];
    }

    /**
     * Attributs journalisés comme modifiés, sans leur valeur (téléphone, IBAN…), en plus des attributs cachés et chiffrés.
     *
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return [];
    }

    /**
     * @return MorphMany<AuditLog, $this>
     */
    public function auditLogs(): MorphMany
    {
        return $this->morphMany(AuditLog::class, 'subject');
    }
}
