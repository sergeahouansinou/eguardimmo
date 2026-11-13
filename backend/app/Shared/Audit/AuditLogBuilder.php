<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use LogicException;

/**
 * @extends Builder<AuditLog>
 */
final class AuditLogBuilder extends Builder
{
    public function forSubject(string $type, string $id): self
    {
        return $this->where('subject_type', $type)->where('subject_id', $id);
    }

    public function byActor(string $userId): self
    {
        return $this->where('actor_user_id', $userId);
    }

    public function inOrganization(string $organizationId): self
    {
        return $this->where('organization_id', $organizationId);
    }

    public function actionStartingWith(string $prefixe): self
    {
        return $this->whereRaw("action like ? escape '!'", [str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $prefixe).'%']);
    }

    public function occurredBetween(?DateTimeInterface $debut, ?DateTimeInterface $finExclue): self
    {
        return $this
            ->when($debut !== null, fn (self $q): self => $q->where('occurred_at', '>=', $debut?->format(PreciseTimestamp::FORMAT)))
            ->when($finExclue !== null, fn (self $q): self => $q->where('occurred_at', '<', $finExclue?->format(PreciseTimestamp::FORMAT)));
    }

    public function newestFirst(): self
    {
        return $this->orderByDesc('occurred_at')->orderByDesc('id');
    }

    /**
     * @param  array<mixed>  $values
     */
    public function update(array $values): never
    {
        throw new LogicException('Le journal d\'audit est en ajout seul.');
    }

    public function delete(): never
    {
        throw new LogicException('Le journal d\'audit est en ajout seul.');
    }

    public function forceDelete(): never
    {
        throw new LogicException('Le journal d\'audit est en ajout seul.');
    }
}
