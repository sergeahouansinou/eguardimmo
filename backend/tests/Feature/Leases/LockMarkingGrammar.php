<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Grammars\SQLiteGrammar;

final class LockMarkingGrammar extends SQLiteGrammar
{
    protected function compileLock(Builder $query, $value)
    {
        return $value === true ? ' /* for update */' : '';
    }
}
