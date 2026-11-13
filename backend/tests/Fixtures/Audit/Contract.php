<?php

declare(strict_types=1);

namespace Tests\Fixtures\Audit;

use App\Shared\Audit\Auditable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\AsEncryptedArrayObject;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Hidden(['secret'])]
final class Contract extends Model
{
    use Auditable, HasUuids, SoftDeletes;

    protected $table = 'contracts_audit_test';

    protected $guarded = [];

    protected $casts = ['iban' => 'encrypted', 'notes' => AsEncryptedArrayObject::class];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['views'];
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['phone'];
    }
}
