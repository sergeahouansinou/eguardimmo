<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use LogicException;

/**
 * @property string $id
 * @property CarbonImmutable $occurred_at
 * @property string $action
 * @property string|null $actor_user_id
 * @property string|null $organization_id
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property array<string, array{old: mixed, new: mixed}>|null $changes
 * @property array<string, mixed> $metadata
 * @property string|null $request_id
 * @property string|null $route
 * @property string|null $ip
 * @property string|null $user_agent
 */
final class AuditLog extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    public const CREATED_AT = null;

    protected $table = 'audit_logs';

    protected $guarded = ['id'];

    protected $casts = [
        'occurred_at' => PreciseTimestamp::class,
        'changes' => 'array',
        'metadata' => 'array',
    ];

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        if ($this->exists) {
            throw new LogicException('Le journal d\'audit est en ajout seul.');
        }

        return parent::save($options);
    }

    public function delete(): never
    {
        throw new LogicException('Le journal d\'audit est en ajout seul.');
    }

    /**
     * @param  \Illuminate\Database\Query\Builder  $query
     * @return Builder<AuditLog>
     */
    public function newEloquentBuilder($query): Builder
    {
        return new AuditLogBuilder($query);
    }
}
