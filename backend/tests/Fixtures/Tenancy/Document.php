<?php

declare(strict_types=1);

namespace Tests\Fixtures\Tenancy;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

final class Document extends Model
{
    use BelongsToOrganization;

    protected $table = 'documents_tenancy_test';

    protected $guarded = [];

    public $timestamps = false;
}
