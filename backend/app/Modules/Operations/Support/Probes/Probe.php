<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support\Probes;

use App\Modules\Operations\Data\ProbeResult;

interface Probe
{
    public function key(): string;

    public function run(): ProbeResult;
}
